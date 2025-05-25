import { GraphModel } from './graphModel.js';

// Initialize the application when the DOM is loaded
function initApp() {
  console.log("Initializing application...");

  try {
      container = document.getElementById("central-screen");
      if (!container) {
          throw new Error("Could not find #central-screen element!");
      }

      console.log("Creating GraphModel...");

      // Create GraphModel with a callback to initialize visualization when data is loaded
      graphModel = new GraphModel((success) => {
          console.log("GraphModel callback executed, success:", success);

          // Only create the visualization after the data has been loaded
          if (!visualization && success) {
              visualization = createVisualization();
              container.appendChild(visualization.svg.node());

              // Add controls after visualization is created
              addZoomControls(container, visualization);
              createNodeEditPanel(container);
              addFileControls(container);

              // Automatically center the graph and fit all nodes
              setTimeout(() => {
                  // First center the graph
                  centerGraph(visualization.simulation);

                  // After centering, zoom to fit all nodes
                  setTimeout(() => {
                      zoomToFitAllNodes(visualization);
                  }, 2500); // Wait for centering animation to complete
              }, 500); // Small delay to ensure visualization is fully rendered
          }
      });

      // Handle send button click
      document.querySelector('.send-button').addEventListener('click', () => {
          // Specifically target the input in the footer rather than any input
          const input = document.querySelector('footer input[type="text"]');
          const text = input.value.trim();

          console.log('Send button clicked, text:', text);

          if (text) {
              // Store the text for later use
              pendingNodeText = text;

              // Enter creation mode
              enterCreationMode(pendingNodeText);

              // Clear the input field
              input.value = '';
          }
      });

      // Handle Enter key in input
      document.querySelector('footer input[type="text"]').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
              document.querySelector('.send-button').click();
          }
      });
  } catch (error) {
      console.error("Error initializing app:", error);
  }
}

// Start the application when the DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
      console.log("DOM content loaded, initializing app...");
      initApp();
  } catch (error) {
      console.error("Error initializing app:", error);
  }
}); 

// Handle key presses for both edit and creation modes
function handleEscKeyPress(event) {
  if (event.key === 'Escape') {
      if (isEditMode) {
          exitEditMode();
      } else if (isCreationMode) {
          exitCreationMode();
      }
  }
}


// Add file controls for saving and loading the graph
function addFileControls(container) {
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'file-controls';

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.className = 'file-btn save-btn';
  saveBtn.innerHTML = '💾';
  saveBtn.title = 'Save Graph';
  saveBtn.addEventListener('click', () => {
      // Save to a central file
      graphModel.saveToFile(dataSource)
          .then(success => {
              if (success) {
                  showNotification(`Graph saved as ${dataSource}. Your changes have been saved to the downloaded file.`);
              } else {
                  showNotification('Failed to save graph', 'error');
              }
          });
  });

  // Load button
  const loadBtn = document.createElement('button');
  loadBtn.className = 'file-btn load-btn';
  loadBtn.innerHTML = '📂';
  loadBtn.title = 'Load Graph';

  // Create a hidden file input element
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';

  // When load button is clicked, trigger the file input dialog
  loadBtn.addEventListener('click', () => {
      fileInput.click();
  });

  // When a file is selected, load it
  fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
          const file = e.target.files[0];

          graphModel.loadFromFile(file)
              .then(success => {
                  showNotification(`Graph loaded successfully from ${file.name}`, 'success');
                  redrawGraph();
              })
              .catch(error => {
                  showNotification(`Failed to load graph: ${error.message}`, 'error');
              });
      }
  });

  // Add buttons to container
  controlsContainer.appendChild(saveBtn);
  controlsContainer.appendChild(loadBtn);
  controlsContainer.appendChild(fileInput);

  // Add controls to the main container
  container.appendChild(controlsContainer);
}
