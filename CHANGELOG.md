# Changelog

## [Unreleased] - 2026-03-28

### Added

- **Node 2.0 (Vue Nodes) Ghosting Mode Support**
  - Partial support for Vue nodes mode ghosting

## [1.0.0] - 2026-03-27

### Initial Release

#### Added
- **LiteGraph Performance Enhancements**
  - Disabled node drop shadows
  - Turns off connection borders and high-quality render mode

- **Ghosting Mode**
  - Temporarily hide nodes and groups while dragging
  - Minimalist nodes rendering
  - Improves FPS when working with node heavy workflows

#### Integration Features
- **UE Nodes (cg-use-everywhere) Support**
  - Automatic hiding of use_everywhere links during ghosting mode
  - Temporary disables UE links when nodes are being moved
  - Widget processing is skipped during node dragging to reduce UI updates and improve FPS
  - Configurable via `LGCTinyPerf > UE Nodes` setting in ComfyUI settings

#### Configuration
- Automatic application of performance tweaks on ComfyUI startup
- No additional configuration required for basic usage
