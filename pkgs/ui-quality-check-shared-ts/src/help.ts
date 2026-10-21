export const HELP = `ui-quality-check — offline visual quality checking

Usage:
  ui-quality-check setup [--model-dir DIR] [--source-path CHECKPOINT]
  ui-quality-check image SCREEN.png [--threshold NUMBER]
  ui-quality-check video TEST.webm [--artifacts DIR] [--failure-clip-ms 1000]
  ui-quality-check check DIRECTORY [--config FILE] [--json]
  ui-quality-check DIRECTORY
  ui-quality-check calibrate --good DIR --bad DIR [--output CONFIG.json]
  ui-quality-check benchmark DIRECTORY [--batch-size 32] [--sampling-fps 4]

Options:
  --json                         Machine-readable output (all commands)
  --threshold NUMBER             Explicit calibrated quality threshold [0,1]
  --model-dir DIR                Prepared offline model directory
  --provider auto|cpu|webgpu|coreml|cuda|dml
  --batch-size NUMBER            Frame batch size (default 16)
  --concurrency NUMBER           Concurrent decoders (default 2)
  --sampling-fps NUMBER          Deterministic candidate sampling (default 4)
  --dedupe-threshold NUMBER      Visual difference tolerance (default .004; 0 disables)
  --aggregation minimum|confirmed
  --confirmation-window-ms NUMBER (default 750)
  --artifacts DIR                JSON and full-resolution failure frames
  --failure-clip-ms NUMBER        Context clip length (default 0)
  --worst-frames NUMBER           Maximum frame artifacts (default 3)
  --cache-dir DIR                Optional content-addressed result cache
  --include-empty                Score empty startup/teardown frames too
  --ffmpeg PATH                  Override the bundled decoder
  --help                         This message

Checks never access the network. Run setup explicitly beforehand.
The default 0.5 threshold is experimental; calibrate before gating CI.
Exit: 0 pass; 1 quality failure; 2 configuration/decoder/model error.
Quote glob patterns: ui-quality-check video './reports/**/*.webm'`;
