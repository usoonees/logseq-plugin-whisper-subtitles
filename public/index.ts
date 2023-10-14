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
  error: string;
}


logseq.useSettingsSchema([
  {
    key: "whisperLocalEndpoint",
    title: "logseq-whisper-subtitles-server endpoint",
    type: "string",
    default: "http://127.0.0.1:5014",
    description: "End point of logseq-whisper-subtitles-server",
  },
  {
    key: "modelSize",
    title: "Whisper model size",
    type: "string",
    default: "base",
    description: "tiny, base, small, medium, large",
  },
  {
    key: "minLength",
    title: "Minimum length of a segment",
    type: "number",
    default: 100,
    description: "if set to zero, segments will be split by .?!, otherwise, segments less than minLength will be merged",
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
      if(transcribes.error) {
        logseq.UI.showMsg(transcribes.error, "error");
        return;
      }

      if (transcribes) {
        const source = transcribes.source;
        const blocks = transcribes.segments.map((transcribe) => {
          let content = transcribe.segment;
          if(source == "youtube") {
            content = `{{youtube-timestamp ${transcribe.startTime}}} ${content}`
          } else if (source == "local") {
            content = `{{renderer :media-timestamp, ${transcribe.startTime}}} ${content}`
          } else {
            logseq.UI.showMsg("source not supported yet", "warn");
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
      console.log(e)
      if(e.message == "Failed to fetch") {
        logseq.UI.showMsg("make sure logseq-whisper-subtitles-server is running", "error");
      } else {
        logseq.UI.showMsg("fail to transcribe: "+e.message, "error");
      }
    }
  }
}

export async function localWhisper(content: string, whisperOptions:WhisperOptions): Promise<TranscriptionResponse> {
  const baseUrl = whisperOptions.whisperLocalEndpoint ? whisperOptions.whisperLocalEndpoint : "http://127.0.0.1:5014";
  const graph = await logseq.App.getCurrentGraph();

  // Create a FormData object and append the file
  const formData = new FormData();
  formData.append('model_name', whisperOptions.modelName);
  formData.append('min_length', whisperOptions.minLength);
  formData.append('text', content);
  formData.append('graph_path', graph.path);

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
