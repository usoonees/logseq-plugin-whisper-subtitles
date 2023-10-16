import "@logseq/libs";
import { setup as l10nSetup, t } from "logseq-l10n"; //https://github.com/sethyuan/logseq-l10n
import ja from "./translations/ja.json";
import { IBatchBlock } from "@logseq/libs/dist/LSPlugin.user";
import { IHookEvent } from "@logseq/libs/dist/LSPlugin.user";

interface WhisperOptions {
  whisperLocalEndpoint?: string;
  modelName?: string;
  // segmentSymbols?: string[];
  minLength?: string;
  zhType?: string;
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

export function getWhisperSettings(): WhisperOptions {
  const whisperLocalEndpoint = logseq.settings!["whisperLocalEndpoint"];
  const modelName = logseq.settings!["modelName"];
  const minLength = logseq.settings!["minLength"];
  const zhType = logseq.settings!["zhType"];
  return {
    whisperLocalEndpoint,
    modelName,
    // segmentSymbols,
    minLength,
    zhType,
  };
}

async function main() {
  console.log("whisper-subtitles loaded");
  await l10nSetup({ builtinTranslations: { ja } });
  logseq.useSettingsSchema([
    {
      key: "whisperLocalEndpoint",
      title: t("logseq-whisper-subtitles-server endpoint"),
      type: "string",
      default: "http://127.0.0.1:5014",
      description: t("End point of logseq-whisper-subtitles-server"),
    },
    {
      key: "modelSize",
      title: t("Whisper model size"),
      type: "string",
      default: "base",
      description: "tiny, base, small, medium, large",
    },
    {
      key: "minLength",
      title: t("Minimum length of a segment"),
      type: "number",
      default: 100,
      description: t("if set to zero, segments will be split by .?!, otherwise, segments less than minLength will be merged"),
    },
    {
      key: "zhType",
      title: t("Chinese language type"),
      type: "string",
      default: "zh-cn",
      description: "zh-cn and zh-tw",
    },
  ])
  logseq.Editor.registerSlashCommand(t("whisper-subtitles"), runWhisper);
  logseq.Editor.registerBlockContextMenuItem(t("whisper-subtitles"), runWhisper);
}

export async function runWhisper(b: IHookEvent) {
  const currentBlock = await logseq.Editor.getBlock(b.uuid);
  if (currentBlock) {
    const whisperSettings = getWhisperSettings();
    popupUI(); // show popup
    try {
      const transcribes = await localWhisper(currentBlock.content, whisperSettings);
      if (transcribes.error) {
        logseq.UI.showMsg(transcribes.error, "error");
        return;
      }

      if (transcribes) {
        removePopupUI(); // remove popup
        const source = transcribes.source;
        const blocks = transcribes.segments.map((transcribe) => {
          let content = transcribe.segment;
          if (source == "youtube") {
            content = `{{youtube-timestamp ${transcribe.startTime}}} ${content}`
          } else if (source == "local") {
            content = `{{renderer :media-timestamp, ${transcribe.startTime}}} ${content}`
          } else {
            logseq.UI.showMsg(t("source not supported yet"), "warn");
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
      if (e.message == "Failed to fetch") {
        logseq.UI.showMsg(t("make sure logseq-whisper-subtitles-server is running"), "error");
      } else {
        logseq.UI.showMsg(t("fail to transcribe: ") + e.message, "error");
      }
    }
  }
}

export async function localWhisper(content: string, whisperOptions: WhisperOptions): Promise<TranscriptionResponse> {
  const baseUrl = whisperOptions.whisperLocalEndpoint ? whisperOptions.whisperLocalEndpoint : "http://127.0.0.1:5014";
  const graph = await logseq.App.getCurrentGraph();

  // Create a FormData object and append the file
  const formData = new FormData();
  formData.append('model_name', whisperOptions.modelName);
  formData.append('min_length', whisperOptions.minLength);
  formData.append('text', content);
  formData.append('zh_type', whisperOptions.zhType)
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


//----popup
const keyNamePopup = "whisper--popup";

// Create popup
const popupUI = () => {

  //　Message
  let printMain = `
  ${t("Processing...")}
  `;

  // Create popup
  logseq.provideUI({
    attrs: {
      title: "Whisper subtitles plugin",
    },
    key: keyNamePopup,
    reset: true,
    style: {
      width: "300px",
      height: "300px",
      overflowY: "auto",
      left: "unset",
      bottom: "unset",
      right: "1em",
      top: "4em",
      paddingLeft: "2em",
      paddingTop: "2em",
      backgroundColor: 'var(--ls-primary-background-color)',
      color: 'var(--ls-primary-text-color)',
      boxShadow: '1px 2px 5px var(--ls-secondary-background-color)',
    },
    //<button class="button" id="whisperSubtitles--showSettingsUI" title="plugin settings">⚙️</button>
    template: `
        <div title="">
            ${printMain}
        </div>
        `,

  });
  //setTimeout(() => {
  //plugin settings
  // const showSettingsUI = parent.document.getElementById("whisperSubtitles--showSettingsUI") as HTMLButtonElement | null;
  // if (showSettingsUI) showSettingsUI.addEventListener("click", () => logseq.showSettingsUI(), { once: true });
  //}, 50);
};
// Remove popup
const removePopupUI = () => parent.document.getElementById(logseq.baseInfo.id + "--" + keyNamePopup)?.remove();
//----end popup

logseq.ready(main).catch(console.error)
