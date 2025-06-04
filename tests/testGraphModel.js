import { GraphModel } from '../src/model/graphModel.js';

(async () => {
  const model = new GraphModel(() => {});
  // Wait briefly for possible async operations
  await new Promise(r => setTimeout(r, 100));
  if (model.nodes.length !== 5) {
    console.error('Expected 5 nodes on load');
    process.exit(1);
  }
  const count = model.countDescendants(1);
  if (count !== 4) {
    console.error('Expected 4 descendants for node 1');
    process.exit(1);
  }
  model.addNode('Test', 2);
  if (model.nodes.length !== 6) {
    console.error('Node was not added');
    process.exit(1);
  }
  console.log('All tests passed');
})();
