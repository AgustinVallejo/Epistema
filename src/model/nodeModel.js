// Graph data management
export class NodeData {
    constructor(id, name, description, type, parentID, childrenIDs, x = null, y = null) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.type = type;
        this.parentID = parentID;
        this.childrenIDs = childrenIDs;
        this.x = x;
        this.y = y;
    }
} 