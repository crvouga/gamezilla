# Development-only model preparation. Consumers use the TypeScript setup command.
# Requires torch==2.4.0 transformers==4.57.6 onnx==1.20.1
# onnxruntime==1.24.2 safetensors==0.8.0 numpy==1.26.4.
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from onnx import external_data_helper, numpy_helper
from safetensors.numpy import load_file
from transformers import CLIPModel, CLIPTokenizer

parser = argparse.ArgumentParser(description="Prepare and verify the pinned UIClip vision graph offline")
parser.add_argument("checkpoint", type=Path, help="Directory containing the pinned config.json and model.safetensors")
parser.add_argument("tokenizer", type=Path, help="Local openai/clip-vit-base-patch32 tokenizer at revision 3d74acf9a28c67741b2f4f2ea7635f0aaf6f0268")
parser.add_argument("output", type=Path, help="Scratch output directory; compare with assets before adopting")
args = parser.parse_args()
source = args.checkpoint / "model.safetensors"
assert hashlib.sha256(source.read_bytes()).hexdigest() == "cf8bcb4f3605ab11a64f9ed515ef96c65618071c67e4756921db66a7aebd1820"
args.output.mkdir(parents=True, exist_ok=True)
torch.set_num_threads(4)
model = CLIPModel.from_pretrained(args.checkpoint, local_files_only=True, attn_implementation="eager").eval()
tokenizer = CLIPTokenizer.from_pretrained(args.tokenizer, local_files_only=True)


class Vision(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.vision = model.vision_model
        self.projection = model.visual_projection

    def forward(self, pixel_values):
        return self.projection(self.vision(pixel_values=pixel_values).pooler_output)


vision = Vision().eval()
x = torch.linspace(-1, 1, 2 * 3 * 224 * 224).reshape(2, 3, 224, 224)
prompts = ["ui screenshot. well-designed. a user interface.", "ui screenshot. poor design. a user interface."]
with torch.no_grad():
    expected = vision(x).numpy()
    text = model.get_text_features(**tokenizer(prompts, return_tensors="pt", padding=True))
    text = text / text.norm(dim=-1, keepdim=True)
torch.onnx.export(vision, x, str(args.output / "full.onnx"), input_names=["pixel_values"], output_names=["image_embeds"], dynamic_axes={"pixel_values": {0: "batch"}, "image_embeds": {0: "batch"}}, opset_version=17, dynamo=False)
weights = load_file(source)
lookup = {}
for key, array in weights.items():
    if key.startswith("vision_model.") or key == "visual_projection.weight":
        lookup[hashlib.sha256(array.tobytes()).hexdigest()] = (key, False)
        if array.ndim == 2:
            lookup[hashlib.sha256(array.T.tobytes()).hexdigest()] = (key, True)
graph = onnx.load(args.output / "full.onnx")
graph.producer_name = "ui-quality-check"
graph.producer_version = "0.1.0"
graph.doc_string = "UIClip vision encoder; pinned upstream revision 505d4731b09263c07437a9022d23c800274da56b. MIT."
entries = []
offset = 0
with (args.output / "vision.data").open("wb") as stream:
    for tensor in graph.graph.initializer:
        raw = numpy_helper.to_array(tensor).tobytes()
        key, transpose = lookup[hashlib.sha256(raw).hexdigest()]
        stream.write(raw)
        external_data_helper.set_external_data(tensor, location="vision.data", offset=offset, length=len(raw))
        tensor.ClearField("raw_data")
        tensor.data_location = onnx.TensorProto.EXTERNAL
        entries.append({"tensor": key, "transpose": transpose, "offset": offset, "length": len(raw)})
        offset += len(raw)
onnx.save_model(graph, str(args.output / "vision.onnx"))
(args.output / "weights.json").write_text(json.dumps(entries) + "\n")
(args.output / "prompts.json").write_text(json.dumps({"prompts": prompts, "embeddings": text.tolist()}) + "\n")
session = ort.InferenceSession(str(args.output / "vision.onnx"), providers=["CPUExecutionProvider"])
actual = session.run(None, {"pixel_values": x.numpy()})[0]
error = float(np.abs(actual - expected).max())
assert error < 3e-5, f"ONNX parity failed: {error}"
report = {
    "sourceRevision": "505d4731b09263c07437a9022d23c800274da56b",
    "torch": torch.__version__, "onnx": onnx.__version__, "onnxRuntime": ort.__version__,
    "maximumEmbeddingError": error,
    "graphSha256": hashlib.sha256((args.output / "vision.onnx").read_bytes()).hexdigest(),
    "weightsSha256": hashlib.sha256((args.output / "vision.data").read_bytes()).hexdigest(),
}
(args.output / "parity.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
