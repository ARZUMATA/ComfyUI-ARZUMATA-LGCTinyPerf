// Shared state for LGCTinyPerf extension
// Mutable state that can be accessed across modules

const sharedState = {
    draggingCanvas: false,
    draggingItems: false,
};

/**
 * Updates the drag state flags. Should be called every frame in the draw loop.
 * @param {boolean} draggingCanvas - Whether canvas is being dragged
 * @param {boolean} draggingItems - Whether items are being dragged
 */
function updateDragState(draggingCanvas, draggingItems) {
    sharedState.draggingCanvas = draggingCanvas;
    sharedState.draggingItems = draggingItems;
}

/**
 * Gets the current drag state.
 * @returns {Object} Object with draggingCanvas and draggingItems boolean values
 */
function getDragState() {
    return {
        draggingCanvas: sharedState.draggingCanvas,
        draggingItems: sharedState.draggingItems,
    };
}

export { sharedState, updateDragState, getDragState };
