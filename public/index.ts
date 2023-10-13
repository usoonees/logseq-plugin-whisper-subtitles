import "@logseq/libs"
import { IBatchBlock } from "@logseq/libs/dist/LSPlugin.user";
import { IHookEvent } from "@logseq/libs/dist/LSPlugin.user";

interface WhisperOptions {
  whisperLocalEndpoint?: string;
  modelName?: string;
  // segmentSymbols?: string[];
  minLength?: string;
}

interface TranscriptionSegment {
  segment: string;
  startTime: number;
}

interface TranscriptionResponse {
  segments: TranscriptionSegment[];
  source: string;
}


logseq.useSettingsSchema([
  {
    key: "whisperLocalEndpoint",
    title: "Highlight Color",
    type: "string",
    default: "http://127.0.0.1:5014", // default to false
    description: "",
  },
  {
    key: "modelName",
    title: "Highlight Color in Dark Mode",
    type: "string",
    default: "base",
    description: "",
  },
  {
    key: "minLength",
    title: "Whether to highlight references in linked references",
    type: "number",
    default: 0, // default to false
    description: "",
  },
])

export function getWhisperSettings(): WhisperOptions {
  const whisperLocalEndpoint = logseq.settings!["whisperLocalEndpoint"];
  const modelName = logseq.settings!["modelName"];
  // const segmentSymbols = logseq.settings!["segmentSymbols"];
  const minLength = logseq.settings!["minLength"];
  return {
    whisperLocalEndpoint,
    modelName,
    // segmentSymbols,
    minLength,
  };
}

async function main() {
  console.log("whisper-subtitles loaded")
  logseq.Editor.registerSlashCommand("whisper-subtitles", runWhisper);
  logseq.Editor.registerBlockContextMenuItem("whisper-subtitles", runWhisper);
}

export async function runWhisper(b: IHookEvent) {
  const currentBlock = await logseq.Editor.getBlock(b.uuid);
  if (currentBlock) {
    const whisperSettings = getWhisperSettings();
    try {
      const transcribes = await localWhisper(currentBlock.content, whisperSettings);
      if (transcribes) {
        const source = transcribes.source;
        const blocks = transcribes.segments.map((transcribe) => {
          let content = transcribe.segment;
          if(source == "youtube") {
            content = `{{youtube-timestamp ${transcribe.startTime}}} ${content}`
          }
          const block: IBatchBlock = {
            content: content,
          }
          return block
        })
        await logseq.Editor.insertBatchBlock(currentBlock.uuid, blocks, {
          sibling: false
        })

        setTimeout(async () => {
          logseq.Editor.exitEditingMode()
          const currentPage = await logseq.Editor.getCurrentPage();
          await logseq.Editor.scrollToBlockInPage(currentPage.name, currentBlock.uuid) // scroll back to the video block
        }, 100);

      }
    } catch (e: any) {
      logseq.App.showMsg("get whisper subtitles failed", "error");
    }
  }
}

export async function localWhisper(content: string, openAiOptions:WhisperOptions): Promise<TranscriptionResponse> {
  const baseUrl = openAiOptions.whisperLocalEndpoint ? openAiOptions.whisperLocalEndpoint : "http://127.0.0.1:5014";

  // Create a FormData object and append the file
  const formData = new FormData();
  formData.append('model_name', openAiOptions.modelName);
  formData.append('min_length', openAiOptions.minLength);
  formData.append('text', content);

  // Send a request to the OpenAI API using a form post
  const response = await fetch(baseUrl + '/transcribe', {
    method: 'POST',
    body: formData,
  })

  // Check if the response status is OK
  if (!response.ok) {
    throw new Error(`Error transcribing audio: ${response.statusText}`);
  }

  // Parse the response JSON and extract the transcription
  const jsonResponse: TranscriptionResponse = await response.json();
  return jsonResponse;
}



logseq.ready(main).catch(console.error)
