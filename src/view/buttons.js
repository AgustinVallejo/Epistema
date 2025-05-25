
// Add zoom control buttons to the container
function addZoomControls(container, visualization) {
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'zoom-controls';

  // Zoom in button
  const zoomInBtn = document.createElement('button');
  zoomInBtn.className = 'zoom-btn zoom-in';
  zoomInBtn.innerHTML = '+';
  zoomInBtn.title = 'Zoom In';
  zoomInBtn.addEventListener('click', () => {
      visualization.svg.transition()
          .duration(300)
          .call(visualization.zoom.scaleBy, 1.3);
  });

  // Zoom out button
  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.className = 'zoom-btn zoom-out';
  zoomOutBtn.innerHTML = '−'; // Unicode minus sign
  zoomOutBtn.title = 'Zoom Out';
  zoomOutBtn.addEventListener('click', () => {
      visualization.svg.transition()
          .duration(300)
          .call(visualization.zoom.scaleBy, 0.7);
  });

  // Reset view button
  const resetBtn = document.createElement('button');
  resetBtn.className = 'zoom-btn reset-view';
  resetBtn.innerHTML = '⟲'; // Unicode refresh symbol
  resetBtn.title = 'Reset View';
  resetBtn.addEventListener('click', () => {
      visualization.svg.transition()
          .duration(750)
          .call(visualization.zoom.transform, d3.zoomIdentity);
  });

  // Center graph button
  const centerGraphBtn = document.createElement('button');
  centerGraphBtn.className = 'zoom-btn center-graph';
  centerGraphBtn.innerHTML = '⌖'; // Unicode target symbol
  centerGraphBtn.title = 'Group Nodes';
  centerGraphBtn.addEventListener('click', () => {
      centerGraph(visualization.simulation);
  });

  // Fit all nodes button
  const fitNodesBtn = document.createElement('button');
  fitNodesBtn.className = 'zoom-btn fit-nodes';
  fitNodesBtn.innerHTML = '⊡'; // Unicode containing symbol
  fitNodesBtn.title = 'Fit All Nodes';
  fitNodesBtn.addEventListener('click', () => {
      zoomToFitAllNodes(visualization);
  });

  // Add buttons to container
  controlsContainer.appendChild(zoomInBtn);
  controlsContainer.appendChild(zoomOutBtn);
  controlsContainer.appendChild(resetBtn);
  controlsContainer.appendChild(centerGraphBtn);
  controlsContainer.appendChild(fitNodesBtn);

  // Add controls to the main container
  container.appendChild(controlsContainer);
}