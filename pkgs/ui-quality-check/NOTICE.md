# Third-party notices

The prepared vision graph and fixed text embeddings derive from UIClip, by the Beneficial Intelligence Group at Carnegie Mellon University. The pinned [official model card](https://huggingface.co/biglab/uiclip_jitteredwebsites-2-224-paraphrased_webpairs_humanpairs) declares the model MIT licensed. See [MODEL.md](MODEL.md) for exact source revision and checksums, and the [authors' paper](https://arxiv.org/abs/2404.12500) for attribution and model purpose. The underlying model architecture/tokenizer derives from OpenAI CLIP.

ONNX Runtime, Sharp and FFmpeg retain their respective upstream licenses and notices in their installed packages. `ffmpeg-static` supplies an independently built FFmpeg executable; its GPL licensing and corresponding build/source information are provided by that dependency. The checker does not modify that executable.

Generic clock, HTTP, process and object-store utility implementations are bundled into the standalone distribution under this package's MIT license. No repository application or test-framework runtime code is bundled.
