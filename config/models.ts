import {
  LLAMA3_2_1B_SPINQUANT,
  LLAMA3_2_3B_QLORA,
  LLAMA3_2_TOKENIZER,
  LLAMA3_2_TOKENIZER_CONFIG,
} from "react-native-executorch"

export interface LocalModelOption {
  id: string
  name: string
  description: string
  sizeGB?: number
  speedHint?: string
  modelSource: any
  tokenizerSource: any
  tokenizerConfigSource: any
  disabled?: boolean
}

export const LOCAL_MODELS: LocalModelOption[] = [
  {
    id: 'llama3.2-3b-qlora',
    name: 'Llama 3.2 3B (QLoRA)',
    description:
      'Modelo de alta calidad para tareas conversacionales y generación de texto coherente. Recomendado para dispositivos modernos con buena RAM y CPU. Ofrece mejor comprensión y respuestas más precisas.',
    sizeGB: 2.65,
    speedHint: 'Calidad alta — puede tardar varios segundos en generar respuestas en dispositivos móviles.',
    modelSource: LLAMA3_2_3B_QLORA,
    tokenizerSource: LLAMA3_2_TOKENIZER,
    tokenizerConfigSource: LLAMA3_2_TOKENIZER_CONFIG,
  },
  {
    id: 'llama3.2-1b-spinquant',
    name: 'Llama 3.2 1B (SpinQuant)',
    description:
      'Modelo optimizado para dispositivos móviles y de bajo consumo. Ideal para tareas de conversación y generación de texto en tiempo real.',
    sizeGB: 1.14,
    speedHint: 'Rápido y eficiente — diseñado para funcionar en una variedad de dispositivos.',
    modelSource: LLAMA3_2_1B_SPINQUANT,
    tokenizerSource: LLAMA3_2_TOKENIZER,
    tokenizerConfigSource: LLAMA3_2_TOKENIZER_CONFIG

  },
]

export const DEFAULT_MODEL_ID = LOCAL_MODELS[0].id
