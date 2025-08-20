import { Chat } from "@/components/chat"
import React from "react"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"

export default () => {

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <Chat />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
