"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Plus, ClipboardList } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageBackButton } from "@/components/layout/page-back-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getProductionTasks, makeTaskId, saveProductionTasks, type ProductionTask } from "@/lib/production-tasks";
import { cn } from "@/lib/utils";

export default function ProductionTasksPage() {
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTasks(getProductionTasks());
  }, []);

  const todoTasks = useMemo(() => tasks.filter(task => task.status === "todo"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter(task => task.status === "completed").slice(0, 5), [tasks]);

  const persist = (next: ProductionTask[]) => {
    setTasks(next);
    saveProductionTasks(next);
  };

  const addTask = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setMessage("Task title is required.");
      return;
    }

    const nextTask: ProductionTask = {
      id: makeTaskId(),
      title: cleanTitle,
      description: description.trim() || undefined,
      status: "todo",
      createdAt: new Date().toISOString()
    };

    persist([nextTask, ...tasks]);
    setTitle("");
    setDescription("");
    setMessage("Task added.");
  };

  const completeTask = (id: string) => {
    const now = new Date().toISOString();
    persist(tasks.map(task => task.id === id ? { ...task, status: "completed", completedAt: now } : task));
    setMessage("Task completed.");
  };

  return (
    <AppShell>
      <PageBackButton fallbackHref="/production" />
      {message && <div className="mb-3 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-[12.5px] text-primary">{message}</div>}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-sm uppercase text-primary">Production</p>
          <h2 className="mt-1 text-[32px] font-bold leading-tight text-white">Tasks</h2>
        </div>
        <span className="mt-2 rounded-full border border-outline-variant/30 bg-surface-container px-2.5 py-1 text-[11px] font-bold text-on-surface-variant">
          {todoTasks.length} open
        </span>
      </div>

      <Card className="mt-4 rounded-lg border border-outline-variant/30 bg-surface-container p-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h3 className="text-[15px] font-semibold text-white">Add task</h3>
        </div>
        <div className="mt-3 space-y-2">
          <Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Task title" className="h-10 text-[13px]" />
          <Textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Description optional" className="min-h-20 text-[13px]" />
          <Button type="button" className="h-10 w-full" onClick={addTask}>
            <Plus className="h-4 w-4" /> Add task
          </Button>
        </div>
      </Card>

      <section className="mt-4 space-y-2">
        <h3 className="text-[14px] font-semibold text-white">To do</h3>
        {todoTasks.length === 0 ? (
          <Card className="rounded-lg border border-outline-variant/25 bg-surface-container p-3 text-[13px] text-on-surface-variant">
            No open production tasks.
          </Card>
        ) : todoTasks.map(task => (
          <TaskRow key={task.id} task={task} onComplete={() => completeTask(task.id)} />
        ))}
      </section>

      <section className="mt-4 space-y-2 pb-16">
        <h3 className="text-[14px] font-semibold text-white">Completed</h3>
        {completedTasks.length === 0 ? (
          <Card className="rounded-lg border border-outline-variant/25 bg-surface-container p-3 text-[13px] text-on-surface-variant">
            Completed tasks will appear here.
          </Card>
        ) : completedTasks.map(task => (
          <TaskRow key={task.id} task={task} />
        ))}
      </section>
    </AppShell>
  );
}

function TaskRow({ task, onComplete }: Readonly<{ task: ProductionTask; onComplete?: () => void }>) {
  const isDone = task.status === "completed";
  return (
    <Card className="rounded-lg border border-outline-variant/25 bg-surface-container p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-[14px] font-semibold", isDone ? "text-on-surface-variant line-through" : "text-white")}>{task.title}</p>
          {task.description && <p className="mt-1 text-[12.5px] leading-5 text-on-surface-variant">{task.description}</p>}
          <p className="mt-1 text-[11.5px] text-on-surface-variant">
            {isDone && task.completedAt ? `Completed ${new Date(task.completedAt).toLocaleString()}` : `Created ${new Date(task.createdAt).toLocaleString()}`}
          </p>
        </div>
        {!isDone && onComplete && (
          <Button type="button" size="sm" className="h-8 shrink-0 px-2 text-[12px]" onClick={onComplete}>
            <CheckCircle2 className="h-4 w-4" /> Complete
          </Button>
        )}
      </div>
    </Card>
  );
}
