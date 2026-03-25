# ComfyUI-ARZUMATA-LGCTinyPerf

A lightweight ComfyUI LiteGraph performance enhancement that optimizes rendering by disabling visual effects and implementing ghosting mode during interactions. Results may vary depending on system configuration. Developed as a learning project for ComfyUI node hooking, this tool can also benefit users working with UI-heavy custom nodes that add additional rendering overhead.

## What It Does

This custom node applies performance optimizations to the ComfyUI LiteGraph canvas:

- **Disables shadows** - Removes node drop shadows
- **Simplified rendering** - Turns off connection borders and high-quality render mode
- **Ghosting mode** - Temporarily hides nodes/groups while dragging for smoother interaction
- **Minimalist UI** - Basic box rendering during performance-critical operations

## Installation

Place this folder in your `ComfyUI/custom_nodes/` directory.

## Usage

The tweaks are applied automatically when ComfyUI starts. No additional configuration needed.

## Preview

https://github.com/user-attachments/assets/044557a3-b72c-469e-81c3-723adf289033

## Third-Party Integration

### UE Nodes
This extension works with **[cg-use-everywhere](https://github.com/chrisgoringe/cg-use-everywhere)**:

- When **ghosting mode** is active, use_everywhere links are automatically hidden for better performance by setting show links to off
- When **nodes are being moved**, UE links are also temporarily disabled
- Upon completion of dragging/movement, the original UE link rendering setting is restored

This integration can be enabled/disabled via the `LGCTinyPerf > UE Nodes` setting in ComfyUI settings.
