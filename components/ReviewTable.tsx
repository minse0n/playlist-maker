"use client";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TrackRow from "@/components/TrackRow";
import type { PipelineTrack } from "@/lib/types";

export default function ReviewTable({
  tracks,
  onReorder,
  onSelectAlternative,
  onRemove,
  onToggleSkip,
  onResearch,
  onEditRawLine,
}: {
  tracks: PipelineTrack[];
  onReorder: (orderedIds: string[]) => void;
  onSelectAlternative: (lineIndex: number, videoId: string) => void;
  onRemove: (lineIndex: number) => void;
  onToggleSkip: (lineIndex: number) => void;
  onResearch: (lineIndex: number) => void;
  onEditRawLine: (lineIndex: number, newLine: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tracks.findIndex((t) => t.id === active.id);
    const newIndex = tracks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...tracks];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    onReorder(reordered.map((t) => t.id));
  }

  if (tracks.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              onSelectAlternative={(videoId) => onSelectAlternative(track.lineIndex, videoId)}
              onRemove={() => onRemove(track.lineIndex)}
              onToggleSkip={() => onToggleSkip(track.lineIndex)}
              onResearch={() => onResearch(track.lineIndex)}
              onEditRawLine={(newLine) => onEditRawLine(track.lineIndex, newLine)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
