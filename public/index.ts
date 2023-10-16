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
      type: "enum",
      default: "base",
      enumChoices: ["tiny", "base", "small", "medium", "large"],
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
      type: "enum",
      default: "zh-cn",
      enumChoices: ["zh-cn", "zh-tw"],
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

    // show popup
    popupUI(`
    <div id="whisper-subtitles-loader-container">
      <div id="whisper-subtitles-loader"></div>
      <p data-message="processing">${t("Processing...")}</p>
    </div>
    <p> ${t("It will take a few minutes.")}</p>
    `, currentBlock.uuid); // dot select

    try {
      const transcribes = await localWhisper(currentBlock.content, whisperSettings);
      removePopupUI(); // remove popup
      if (transcribes.error) {
        logseq.UI.showMsg(transcribes.error, "error");
        return;
      }

      if (transcribes) {
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


//----popup UI

const keyNamePopup = "whisper--popup"; // key name for popup

// Update message
// Use this when a popup is displayed and you want to change the message midway through.
const updatePopupUI = (messageHTML: string) => {
  const messageEl = parent.document.getElementById("whisperSubtitles--message") as HTMLDivElement | null;
  if (messageEl) messageEl.innerHTML = messageHTML; // if popup is already displayed, update message
  else popupUI(messageHTML); // if popup is not displayed, create popup with message
};

// Create popup
const popupUI = (printMain: string, targetBlockUuid?: string) => {
  // dot select
  const dotSelect = targetBlockUuid ? `
  &#root>div {
    &.light-theme>main>div span#dot-${targetBlockUuid}{
        outline: 2px solid var(--ls-link-ref-text-color);
    }
    &.dark-theme>main>div span#dot-${targetBlockUuid}{
        outline: 2px solid aliceblue;
    }
  }
  ` : "";
  logseq.provideUI({
    attrs: {
      title: "Whisper subtitles plugin",
    },
    key: keyNamePopup,
    reset: true,
    style: {
      width: "330px", // width
      minHeight: "220px", // min-height
      maxHeight: "400px", // max-height
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
    template: `
        <div title="">
            <p>Whisper subtitles ${t("plugin")} <button class="button" id="whisperSubtitles--showSettingsUI" title="${t("plugin settings")}">⚙️</button></p>
            <div id="whisperSubtitles--message">
            ${printMain}
            </div>
        </div>
        <style>
      body>div {
        ${dotSelect}
        &#${logseq.baseInfo.id}--${keyNamePopup} {
          & button.button#whisperSubtitles--showSettingsUI {
            display: unset;
          }
          & div#whisperSubtitles--message {
            &>div#whisper-subtitles-loader-container {
              display: flex;
              justify-content: center;
              align-items: center;
              flex-direction: column;
              width: 100px;
              height: 100px;
              &>div#whisper-subtitles-loader {
                border: 15px solid #39d4ff;
                border-radius: 50%;
                width: 60px;
                height: 60px;
                animation: spin 2s linear infinite;
              }
              &>p[data-message="processing"] {
                font-size: 1.2em;
                line-height: 1.5em;
              }
            }
          }
        }
      }
        @keyframes spin{
          0%{
            transform: rotate(0deg);
          }
          50%{
            transform: rotate(180deg);
            border-radius: 0%;
            width: 20px;
            height: 20px;
            border: 5px double #061fd5;
          }
          100%{
            transform: rotate(360deg);
          }
        }
        </style>
        `,
  });
  setTimeout(() => {
    //plugin settings button
    const showSettingsUI = parent.document.getElementById("whisperSubtitles--showSettingsUI") as HTMLButtonElement | null;
    if (showSettingsUI) showSettingsUI.addEventListener("click", () => logseq.showSettingsUI(), { once: true });
  }, 50);
};

// Remove popup from DOM
const removePopupUI = () => parent.document.getElementById(logseq.baseInfo.id + "--" + keyNamePopup)?.remove();

//----end popup UI

logseq.ready(main).catch(console.error)
