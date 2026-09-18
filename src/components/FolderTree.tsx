import { useMemo, useState } from "react";
import type { Folder } from "../lib/types";
import { IconChevronDown, IconChevronRight, IconFolder, IconPencil, IconPlus, IconTrash } from "./Icons";

interface Props {
  folders: Folder[];
  selected: string | null; // null = "All links"
  onSelect: (id: string | null) => void;
  onCreate: (parentId: string | null) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}

interface TreeNode extends Folder {
  children: TreeNode[];
}

function buildTree(folders: Folder[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  folders.forEach((f) => byId.set(f.id, { ...f, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function FolderRow({
  node,
  depth,
  selected,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
} & Omit<Props, "folders">) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-lg py-1.5 pr-1.5 text-sm ${
          selected === node.id ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 ${!hasChildren ? "invisible" : ""}`}
        >
          {open ? <IconChevronDown className="h-3.5 w-3.5" /> : <IconChevronRight className="h-3.5 w-3.5" />}
        </button>
        <button onClick={() => onSelect(node.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <IconFolder className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <button
            title="New subfolder"
            onClick={() => onCreate(node.id)}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <IconPlus className="h-3 w-3" />
          </button>
          <button
            title="Rename"
            onClick={() => onRename(node)}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <IconPencil className="h-3 w-3" />
          </button>
          <button
            title="Delete"
            onClick={() => onDelete(node)}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-red-600"
          >
            <IconTrash className="h-3 w-3" />
          </button>
        </div>
      </div>
      {open && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              onCreate={onCreate}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({ folders, selected, onSelect, onCreate, onRename, onDelete }: Props) {
  const tree = useMemo(() => buildTree(folders), [folders]);

  return (
    <div className="space-y-1">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Folders</span>
        <button
          title="New folder"
          onClick={() => onCreate(null)}
          className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
        >
          <IconPlus className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        onClick={() => onSelect(null)}
        className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 pl-2 text-sm font-medium ${
          selected === null ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <IconFolder className="h-3.5 w-3.5" />
        All links
      </button>
      {tree.map((node) => (
        <FolderRow
          key={node.id}
          node={node}
          depth={0}
          selected={selected}
          onSelect={onSelect}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
