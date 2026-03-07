export type PatchRow = {
    patch_id: string;
    entity_id: string;
    entity_type: string;
    attributes: string;
    created_at: string;
    recorded_at: string;
    parent_id: string | null;
    metadata: string;
};

export type SnapshotRow = {
    entity_id: string;
    entity_type: string;
    attributes: string;
};
