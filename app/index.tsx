import { ONBOARDING_KEY } from "@/constants/storage"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Haptics from 'expo-haptics'
import { useRouter } from "expo-router"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native"
import { Onboarding } from "react-native-app-onboard"

const PAGES = [
  {
    key: 'welcome',
    backgroundColor: '#0f1115',
    image: require('./../assets/images/react-logo.png'),
    title: 'Asistente LLM Offline',
    subtitle: 'Obtén respuestas inteligentes totalmente sin conexión y mantén tus datos en tu dispositivo.',
  },
  {
    key: 'perf',
    backgroundColor: '#0f1115',
    image: require('./../assets/images/react-logo.png'),
    title: 'Rendimiento y Espacio',
    subtitle: 'Si tu dispositivo es lento, la primera respuesta puede tardar más. El modelo ocupa bastante espacio (cientos de MB). Mantén batería y espacio libre.',
  },
  {
    key: 'privacy',
    backgroundColor: '#0f1115',
    image: require('./../assets/images/react-logo.png'),
    title: 'Privacidad & Velocidad',
    subtitle: 'Procesamiento local: no subes texto a servidores. Menor latencia y máximo control.',
  },
  {
    key: 'control',
    backgroundColor: '#0f1115',
    image: require('./../assets/images/react-logo.png'),
    title: 'Control de Conversación',
    subtitle: 'Interrumpe, regenera y limpia el chat cuando quieras. Listo para empezar ahora.',
  },
]

export default function OnboardingScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const stored = await AsyncStorage.getItem(ONBOARDING_KEY)
          if (!mounted) return
          if (stored) router.replace('/chat')
          else setVisible(true)
        } catch (e) {
          setVisible(true)
          console.warn('Error leyendo onboarding key', e)
        } finally {
          if (mounted) setLoading(false)
        }
      })()
    return () => { mounted = false }
  }, [router])

  const pages = useMemo(() => PAGES.map(p => ({
    backgroundColor: p.backgroundColor,
    image: <Image source={p.image} />,
    title: p.title,
    subtitle: p.subtitle,
  })), [])

  const handleDone = useCallback(async () => {
    try {
      await Haptics.selectionAsync()
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
    } catch (e) {
      console.warn('Error guardando onboarding', e)
    }
    router.replace('/chat')
  }, [router])

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#140E17' }}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  if (!visible) return null

  return (
    <View style={{ flex: 1 }}>
      <Onboarding showDone pages={pages} onDone={handleDone} />
      <TouchableOpacity
        accessibilityRole="button"
        onPress={handleDone}
        style={{ position: 'absolute', top: 48, right: 18, padding: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Saltar</Text>
      </TouchableOpacity>
    </View>
  )
}
