// Function to zoom out to fit all nodes in the viewport
export function zoomToFitAllNodes(visualization) {
  // Safety check
  if (!visualization || !visualization.nodeGroup || !graphModel || graphModel.getNodes().length === 0) {
      console.warn("Cannot zoom to fit: visualization or nodes not available");
      return;
  }

  const nodes = graphModel.getNodes();

  // Find the bounds of all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
          const nodeSize = getNodeSize(node);
          minX = Math.min(minX, node.x - nodeSize);
          minY = Math.min(minY, node.y - nodeSize);
          maxX = Math.max(maxX, node.x + nodeSize);
          maxY = Math.max(maxY, node.y + nodeSize);
      }
  });

  // If we couldn't determine bounds, return
  if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
      console.warn("Cannot determine node bounds for zooming");
      return;
  }

  // Get the dimensions of the container
  const { width, height } = getScreenDimensions();

  // Add padding
  const padding = 50;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  // Calculate the scale
  const dx = maxX - minX;
  const dy = maxY - minY;
  const scale = Math.min(width / dx, height / dy, 1); // Cap at 1x to prevent excessive zoom in

  // Calculate the translate
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const translateX = width / 2 - scale * centerX;
  const translateY = height / 2 - scale * centerY;

  // Apply the transform
  visualization.svg.transition()
      .duration(750)
      .call(
          visualization.zoom.transform,
          d3.zoomIdentity
              .translate(translateX, translateY)
              .scale(scale)
      );
}