import { saveNodeEdits } from './nodeView.js';
import { exitEditMode, container } from './graphView.js';

let creationHelpText = null;

// Show a notification message
export function showNotification(message, type = 'success') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  // Add to body
  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
      notification.classList.add('visible');
  }, 10);

  // Calculate display time based on message length
  const displayTime = message.length > 50 ? 5000 : 3000;

  // Remove after delay
  setTimeout(() => {
      notification.classList.remove('visible');

      // Remove element after fade out
      setTimeout(() => {
          notification.remove();
      }, 300);
  }, displayTime);
}


// Create the node edit panel
export function createNodeEditPanel(container) {
  // Create the panel element
  const panel = document.createElement('div');
  panel.className = 'node-edit-panel';
  panel.id = 'node-edit-panel';

  // Add panel content
  panel.innerHTML = `
  <h3>Edit Node</h3>
  <div class="edit-field">
    <label for="node-name">Name</label>
    <input type="text" id="node-name" placeholder="Node name">
  </div>
  <div class="edit-field">
    <label for="node-description">Description</label>
    <textarea id="node-description" placeholder="Node description"></textarea>
  </div>
  <div class="edit-field">
    <label for="node-type">Type</label>
    <select id="node-type">
      <option value="concept">Concept</option>
      <option value="information">Information</option>
      <option value="question">Question</option>
      <option value="answer">Answer</option>
    </select>
  </div>
  <div class="edit-actions">
    <button class="btn-cancel" id="cancel-edit">Cancel</button>
    <button class="btn-save" id="save-edit">Save</button>
  </div>
`;

  // Add the panel to the container
  container.appendChild(panel);

  // Prevent click events on the panel from bubbling up
  panel.addEventListener('click', (event) => {
      event.stopPropagation();
  });

  // Add event listeners for the buttons
  document.getElementById('cancel-edit').addEventListener('click', exitEditMode);
  document.getElementById('save-edit').addEventListener('click', saveNodeEdits);
}


// Show node editing UI
export function showNodeEditUI(node) {
  const panel = document.getElementById('node-edit-panel');
  if (!panel) return;

  // Set input values
  document.getElementById('node-name').value = node.name || '';
  document.getElementById('node-description').value = node.description || '';

  // Set the type selector value
  const typeSelector = document.getElementById('node-type');
  if (typeSelector) {
      typeSelector.value = node.type || 'concept';
  }

  // Show the panel
  panel.classList.add('visible');

  // Focus on the name input
  setTimeout(() => {
      document.getElementById('node-name').focus();
  }, 100);
}

// Hide node editing UI
export function hideNodeEditUI() {
  const panel = document.getElementById('node-edit-panel');
  if (panel) {
      panel.classList.remove('visible');
  }
}


// Show help text for creation mode
export function showCreationHelp() {
  creationHelpText = document.createElement('div');
  creationHelpText.className = 'creation-help-text';
  creationHelpText.innerHTML = 'Click on a node to <span>connect</span> or anywhere else to create <span>standalone</span> node. (Press ESC to cancel)';

  // Add to the container
  container.appendChild(creationHelpText);
}

export function hideCreationHelp() {
  if (creationHelpText) {
      creationHelpText.remove();
      creationHelpText = null;
  }
}
