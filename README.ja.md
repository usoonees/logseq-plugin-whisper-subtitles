# logseq-plugin-whisper-subtitles
(Logseq用プラグイン) Whisper文字起こし [English](https://github.com/usoonees/logseq-whisper-subtitles-server) | [日本語](https://github.com/usoonees/logseq-whisper-subtitles-server/blob/main/README.ja.md)

### 概要

* PC上のローカルで動作させている「Whisper」の処理サーバーと連携し、YouTubeなどの動画から文字起こしをおこないます。**タイムスタンプ付きの字幕**を抽出します。
   > Whisperによって文字起こしをおこない、Logseqにその内容を取り込むまで がローカル内で完結します。

### 依存関係
* OpenAIのWhisper APIは使用しません。動作させるには必ず毎回、このプラグイン用の **[専用サーバー(logseq-whisper-subtitles-server)](https://github.com/usoonees/logseq-whisper-subtitles-server)** を実行させる必要があります。その専用サーバーを介して、データを受信します。(ローカルの「Whisper」の処理サーバーに要求します。)
* このプラグインは現在、YouTubeとローカルファイルの動画をサポートしています。
   > ローカルファイルの動画でのタイムスタンプ ナビゲーション機能を使用するには、[logseq-plugin-media-ts](https://github.com/sethyuan/logseq-plugin-media-ts) プラグインをインストールしてください。

### 使用手順

1. Logseqのマーケットプレースから *Whisper subtitles* プラグインをインストールしてください。
   > プラグイン設定に、Whisperのモデルサイズ、最小セグメント、エンドポイントの指定などの設定項目が用意されています。
1. このプラグイン用の専用サーバーをローカルで起動します。バックグラウンドで動作できるようにしてください。
1. YouTubeの動画などをもつブロックを用意します。
   - YouTubeの場合: そのURLをどこかのブロックに貼り付けると、そのブロックに埋め込まれます。
   - ローカルファイルの場合: コピー&ペーストやドラッグをして、アセットとして埋め込んでください。
1. そのブロックの箇条書き(・)を右クリックし、そのメニューから「文字起こし (Whisper-Subtitles)」という項目を選びます。
   > そうすると、専用サーバーがWhisperの処理サーバーに、その処理を要求します。その要求をしてから、Whisperが文字起こしの処理を終えるまで数分程度、長い時間がかかります。その処理が終わると、そのブロックにタイムスタンプと字幕が抽出されます。

### デモ
#### ブロックに埋め込まれているYouTube
![YouTube デモ](demos/youtube_demo.gif)
#### ブロックに埋め込まれている動画ファイル (ローカル)
![ローカルファイル 動画デモ](demos/local_video.gif)
#### ブロックに埋め込まれているオーディオ (ローカル)
![ローカルファイル オーディオデモ](demos/local_audio.gif)

### 関連リポジトリ
* [Whisper](https://github.com/openai/whisper): 音声認識モデルと呼ばれます。動画からその音声を抽出し、さらにテキストを抽出します。
* [logseq-whisper-subtitles-server](https://github.com/usoonees/logseq-whisper-subtitles-server) - Whisperに処理を要求するための このプラグイン専用サーバーです。
* [logseq-plugin-media-ts](https://github.com/sethyuan/logseq-plugin-media-ts) (Logseq用プラグイン): YouTubeなどの動画やその他のオーディオなどのタイムスタンプを生成するプラグイン。それをクリックしたときに、その対応するビデオ/オーディオの位置に移動します。
