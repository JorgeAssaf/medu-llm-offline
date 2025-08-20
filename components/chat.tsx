import { MAX_MSGS, SYSTEM_PROMPT } from "@/config/prompt";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList, Platform, StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import {
  LLAMA3_2_3B_QLORA,
  LLAMA3_2_TOKENIZER,
  LLAMA3_2_TOKENIZER_CONFIG,
  useLLM,
  type Message,
} from "react-native-executorch";
import Markdown from "react-native-markdown-display";

type ChatUIMessage = Message & {
  id: string
  pending?: boolean
  error?: boolean
  aborted?: boolean
}

export const Chat = () => {
  const llm = useLLM({
    modelSource: LLAMA3_2_3B_QLORA,
    tokenizerSource: LLAMA3_2_TOKENIZER,
    tokenizerConfigSource: LLAMA3_2_TOKENIZER_CONFIG,
  })

  const [messages, setMessages] = useState<ChatUIMessage[]>([])
  const [input, setInput] = useState("")
  const [aborted, setAborted] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const listRef = useRef<FlatList<ChatUIMessage>>(null)
  const mountedRef = useRef(true)

  const safeInterrupt = () => {
    if (!llm) return
    if (!llm.isReady) return
    if (!llm.isGenerating) return
    try {
      llm.interrupt()
    } catch (e) {
      console.warn('Interrupt fallo / ya finalizado', e)
    }
  }

  // Configure model on mount
  useEffect(() => {
    llm.configure({
      chatConfig: {
        systemPrompt: SYSTEM_PROMPT,
        contextWindowLength: 2048,
      },
    })
    return () => {
      mountedRef.current = false
      safeInterrupt()
    }
  }, [])

  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
  }, [messages])

  useEffect(() => {
    if (!messages.length) return
    const lastIndex = messages.length - 1
    const last = messages[lastIndex]
    if (!last || last.role !== "assistant" || !last.pending) return
    if (!mountedRef.current) return
    const newContent = llm.response ?? ""
    const done = !llm.isGenerating
    setMessages((prev) =>
      prev.map((m, i) => {
        if (i !== lastIndex) return m
        const changed = newContent && newContent !== m.content
        if (changed || done) {
          let content = changed ? newContent : m.content
          if (done && aborted) content = content.trimEnd() + " (detenido)"
          return { ...m, content, pending: !done, aborted: done && aborted ? true : m.aborted }
        }
        return m
      }),
    )
    if (done && aborted) setAborted(false)
    if (done && regenerating) setRegenerating(false)
  }, [llm.response, llm.isGenerating])


  const submitChatMessage = (text: string, baseHistory?: ChatUIMessage[]) => {
    const history = (baseHistory ?? messages).filter((m) => !m.pending && !m.error && m.role !== "system")
    const trimmed = history.slice(-MAX_MSGS)
    const request: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...trimmed.map(({ role, content }) => ({ role, content })),
      { role: "user", content: text },
    ]
    const userMsg: ChatUIMessage = { id: Date.now().toString(), role: "user", content: text }
    const placeholder: ChatUIMessage = { id: `pending-${Date.now()}`, role: "assistant", content: "", pending: true }
    setMessages((prev) => [...prev, userMsg, placeholder])
    try {
      llm.generate(request)
    } catch (e) {
      console.error(e)
      setMessages((prev) =>
        prev.map((m) => (m.id === placeholder.id ? { ...m, pending: false, error: true, content: "Error" } : m)),
      )
    }
  }

  const handleSend = () => {
    if (llm.isGenerating) return
    const text = input.trim()
    if (!text) return
    setInput("")
    submitChatMessage(text)
  }

  const handleClear = () => {
    if (llm.isGenerating) safeInterrupt()
    setMessages([])
    setInput("")
  }

  const handleRegenerate = () => {
    if (llm.isGenerating) return
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    if (!lastUser) return
    setRegenerating(true)

    let base = [...messages]
    const last = base[base.length - 1]
    if (last && last.role === "assistant" && !last.pending) {
      base = base.slice(0, -1)
      setMessages(base)
    }
    submitChatMessage(lastUser.content, base)
  }

  if (!llm.isReady) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingLabel}>Cargando modelo {(llm.downloadProgress * 100).toFixed(1)}%</Text>
      </View>
    )
  }

  const renderItem = ({ item }: { item: ChatUIMessage }) => {
    const isUser = item.role === "user"
    return (
      <View style={[styles.messageWrapper, isUser && styles.messageWrapperUser]}>
        <View style={[styles.avatar, isUser ? styles.avatarUser : styles.avatarAssistant]}>
          <Text style={styles.avatarText}>{isUser ? "Tú" : <FontAwesome6 name="robot" />}</Text>
        </View>
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
            item.error && styles.bubbleError,
            item.aborted && styles.bubbleAborted,
          ]}>
          {item.pending && !isUser ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.loadingText}>Generando...</Text>
            </View>
          ) : isUser ? (
            <Text style={styles.text}>{item.content}</Text>
          ) : (
            <Markdown style={markdownStyles}>{item.content}</Markdown>
          )}
          {item.error && <Text style={styles.metaError}>⚠️ Error. Reintenta.</Text>}
          {item.aborted && <Text style={styles.metaAborted}>⏹ Respuesta detenida.</Text>}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="chatbubbles" size={20} color="#60a5fa" />
          <Text style={styles.headerTitle}>Chat Offline LLM</Text>
          <View style={styles.status}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: llm.isGenerating ? "#fbbf24" : "#10b981" },
              ]}
            />
            <Text style={styles.statusText}>
              {llm.isGenerating ? (regenerating ? "regenerando" : "generando") : "listo"}
            </Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.iconBtn}
            disabled={llm.isGenerating || messages.length === 0}
            onPress={handleClear}>
            <Ionicons
              name="trash-outline"
              size={18}
              color={llm.isGenerating || messages.length === 0 ? "#64748b" : "#e2e8f0"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            disabled={llm.isGenerating || !messages.some((m) => m.role === "user")}
            onPress={handleRegenerate}>
            <Ionicons
              name="refresh"
              size={18}
              color={llm.isGenerating || !messages.some((m) => m.role === "user") ? "#64748b" : "#e2e8f0"}
            />
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}

          onChangeText={setInput}
          placeholder="Escribe tu mensaje..."
          placeholderTextColor="#64748b"
          multiline
        />
        {!llm.isGenerating ? (
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || llm.isGenerating) && styles.disabled]}
            disabled={!input.trim() || llm.isGenerating}
            onPress={handleSend}>
            <Ionicons name="send" size={16} color="#fff" />
            <Text style={styles.sendText}>Enviar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, styles.stopBtn]}
            onPress={() => {
              if (!llm.isGenerating) return
              setAborted(true)
              safeInterrupt()
            }}>
            <Ionicons name="stop" size={16} color="#fff" />
            <Text style={styles.sendText}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1115" },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0f1115' },
  loadingLabel: { color: '#e2e8f0', marginTop: 6 },
  header: {
    paddingTop: Platform.OS === 'android' ? 14 : 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: '#0d1522',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '600' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { backgroundColor: '#1e293b', padding: 8, borderRadius: 10 },
  listContent: { padding: 14, paddingBottom: 120 },
  messageWrapper: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-start', gap: 10 },
  messageWrapperUser: { flexDirection: 'row-reverse' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarUser: { backgroundColor: '#1d4ed8' },
  avatarAssistant: { backgroundColor: '#334155' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bubble: {
    maxWidth: '78%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  bubbleUser: { backgroundColor: 'rgba(37,99,235,0.16)', borderColor: '#2563eb55' },
  bubbleAssistant: { backgroundColor: '#162132', borderColor: '#1e293b' },
  bubbleError: { backgroundColor: '#461515', borderColor: '#7f1d1d' },
  bubbleAborted: { borderColor: '#fbbf24' },
  text: { color: '#fff', fontSize: 15, lineHeight: 21, fontWeight: '500' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: '#cbd5e1', fontStyle: 'italic', fontSize: 14 },
  metaError: { marginTop: 6, color: '#f87171', fontSize: 12 },
  metaAborted: { marginTop: 6, color: '#fbbf24', fontSize: 12 },
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0d1522ee',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    color: '#fff',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingHorizontal: 18,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopBtn: { backgroundColor: '#dc2626' },
  disabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})

const markdownStyles = StyleSheet.create({
  body: { color: '#e2e8f0', fontSize: 15, lineHeight: 21 },
  heading1: { color: '#f1f5f9', fontSize: 24, marginTop: 4, marginBottom: 10, fontWeight: '700' as const },
  heading2: { color: '#f1f5f9', fontSize: 20, marginTop: 14, marginBottom: 8, fontWeight: '700' as const },
  heading3: { color: '#f1f5f9', fontSize: 18, marginTop: 12, marginBottom: 6, fontWeight: '600' as const },
  paragraph: { marginTop: 4, marginBottom: 8 },
  strong: { color: '#ffffff', fontWeight: '700' as const },
  em: { fontStyle: 'italic', color: '#cbd5e1' },
  bullet_list: { marginTop: 4, marginBottom: 8 },
  ordered_list: { marginTop: 4, marginBottom: 8 },
  list_item: { flexDirection: 'row', marginBottom: 4 },
  list_item_number: { color: '#93c5fd', marginRight: 6 },
  list_item_bullet: { color: '#38bdf8', marginRight: 8 },
  code_inline: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontFamily: 'SpaceMono-Regular',
    fontSize: 13,
  },
  code_block: {
    backgroundColor: '#0f172a',
    color: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    fontFamily: 'SpaceMono-Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  blockquote: {
    backgroundColor: '#1e293b',
    borderLeftWidth: 4,
    borderLeftColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginVertical: 8,
  },
  blockquote_text: { color: '#cbd5e1' },
  hr: { backgroundColor: '#334155', height: 1, marginVertical: 12 },
  link: { color: '#60a5fa', textDecorationLine: 'underline' },
  table: { borderWidth: 1, borderColor: '#334155', borderRadius: 4 },
  thead: { backgroundColor: '#1e293b' },
  th: { padding: 6, color: '#f1f5f9', fontWeight: '600' },
  tr: { borderBottomWidth: 1, borderBottomColor: '#334155' },
  td: { padding: 6, color: '#e2e8f0' },
  image: { borderRadius: 8, marginVertical: 8 },
  newline: { marginBottom: 0 },
})
