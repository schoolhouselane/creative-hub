import { useState, useEffect } from 'react';
import { createClient } from '@metagptx/web-sdk';
import SidebarLayout from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, LayoutGrid, List, Copy, ChevronDown, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const client = createClient();

interface Prompt {
  id: number;
  title: string;
  tool: string;
  category: string;
  text: string;
}

const CATEGORIES = [
  'All',
  'Social Media',
  'Video Content',
  'Brand Design',
  'Copywriting',
  'Email',
  'Photography',
];

const TOOLS = [
  'NanoBanana',
  'Midjourney',
  'Flux 1.1 Pro',
  'Claude Sonnet',
  'GPT Image',
  'Flux Ultra',
  'DALL·E 3',
  'Stable Diffusion',
];

export default function PromptLibraryPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newTool, setNewTool] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newText, setNewText] = useState('');

  useEffect(() => {
    fetchPrompts();
  }, []);

  async function fetchPrompts() {
    setLoading(true);
    try {
      const res = await client.entities.prompts.query({ sort: '-created_at', limit: 200 });
      setPrompts((res?.data?.items as Prompt[]) || []);
    } catch {
      toast.error('Failed to load prompts');
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredPrompts = prompts.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.tool.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    const matchesCategory =
      categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Prompt copied!');
  }

  async function handleCreatePrompt() {
    if (!newTitle || !newTool || !newCategory || !newText) return;
    setSaving(true);
    try {
      const res = await client.entities.prompts.create({
        data: { title: newTitle, tool: newTool, category: newCategory, text: newText },
      });
      const created = res?.data as Prompt;
      if (created) {
        setPrompts((prev) => [created, ...prev]);
      }
      setNewTitle('');
      setNewTool('');
      setNewCategory('');
      setNewText('');
      setDialogOpen(false);
      toast.success('Prompt created!');
    } catch {
      toast.error('Failed to create prompt');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePrompt(id: number) {
    try {
      await client.entities.prompts.delete({ id });
      setPrompts((prev) => prev.filter((p) => p.id !== id));
      toast.success('Prompt deleted');
    } catch {
      toast.error('Failed to delete prompt');
    }
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#f5f3ef] px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-0">
          <div>
            <h1
              className="font-bold text-[#1e1e20] leading-tight text-[32px] sm:text-[40px] lg:text-[48px]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Prompt Library
            </h1>
            <p
              className="text-[#595959] font-normal mt-2"
              style={{ fontSize: '16px' }}
            >
              Select a category, choose your AI tool, and create brand-consistent assets.
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="flex items-center gap-2 bg-[#1e1e20] text-white hover:bg-[#2e2e30] rounded-lg px-5 py-3"
                style={{ fontSize: '16px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
              >
                <Plus size={18} />
                Create New Prompt
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Create New Prompt</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-2">
                <div>
                  <label className="text-sm font-medium text-[#1e1e20] mb-1 block">Title</label>
                  <Input
                    placeholder="e.g. Prompt: Social Banner"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1e1e20] mb-1 block">AI Tool</label>
                  <Select onValueChange={setNewTool} value={newTool}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tool" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOOLS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1e1e20] mb-1 block">Category</label>
                  <Select onValueChange={setNewCategory} value={newCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1e1e20] mb-1 block">Prompt Text</label>
                  <Textarea
                    placeholder="Enter your prompt template with [PLACEHOLDERS]..."
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button
                  onClick={handleCreatePrompt}
                  disabled={!newTitle || !newTool || !newCategory || !newText || saving}
                  className="bg-[#1e1e20] text-white hover:bg-[#2e2e30] w-full"
                >
                  {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                  Create Prompt
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mt-6 mb-6">
          {/* Search */}
          <div
            className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 flex-1 min-w-[180px]"
            style={{ maxWidth: '307px', height: '36px' }}
          >
            <Search size={18} className="text-[#1e1e20] flex-shrink-0" />
            <input
              type="text"
              placeholder="Search prompt by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 outline-none bg-transparent text-[#1e1e20] w-full"
              style={{ fontSize: '14px', fontWeight: 300 }}
            />
          </div>

          {/* Category dropdown */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none border border-[#e2e2e2] rounded-lg px-3 pr-8 bg-white text-[#1e1e20] font-medium cursor-pointer focus:outline-none"
              style={{ fontSize: '14px', height: '46px' }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#1e1e20]"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center ml-auto gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
            >
              <LayoutGrid size={18} className="text-[#1e1e20]" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
            >
              <List size={18} className="text-[#1e1e20]" />
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#595959]" />
          </div>
        )}

        {/* Cards */}
        {!loading && (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
                : 'flex flex-col gap-4'
            }
          >
            {filteredPrompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onCopy={handleCopy}
                onDelete={handleDeletePrompt}
              />
            ))}
            {filteredPrompts.length === 0 && (
              <p className="col-span-1 sm:col-span-2 text-center text-[#595959] py-12">
                No prompts match your search.
              </p>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}

function PromptCard({
  prompt,
  onCopy,
  onDelete,
}: {
  prompt: Prompt;
  onCopy: (text: string) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="bg-white rounded-xl p-6 flex flex-col gap-4">
      {/* Title */}
      <h2
        className="font-bold text-[#1e1e20] leading-snug"
        style={{ fontSize: '20px' }}
      >
        {prompt.title}
      </h2>

      {/* Tags */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="rounded-lg border border-[#e2e2e2] px-3 py-1.5 bg-white text-[#595959] font-normal"
          style={{ fontSize: '14px' }}
        >
          {prompt.tool}
        </span>
        <span
          className="rounded-lg border border-[#e2e2e2] px-3 py-1.5 bg-white text-[#595959] font-normal"
          style={{ fontSize: '14px' }}
        >
          {prompt.category}
        </span>
      </div>

      {/* Prompt preview */}
      <div className="bg-[#f5f3ef] rounded-lg p-3">
        <p
          className="text-[#8c8c8c] font-bold leading-relaxed"
          style={{ fontSize: '11.8px' }}
        >
          {prompt.text}
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onDelete(prompt.id)}
          className="flex items-center gap-2 border border-[#e2e2e2] text-[#595959] rounded-lg px-4 py-2 hover:bg-[#f5f3ef] transition-colors"
          style={{ fontSize: '14px', fontWeight: 500 }}
        >
          <Trash2 size={14} />
          Delete
        </button>
        <button
          onClick={() => onCopy(prompt.text)}
          className="flex items-center gap-2 bg-[#1e1e20] text-white rounded-lg px-4 py-2 hover:bg-[#2e2e30] transition-colors"
          style={{ fontSize: '14px', fontWeight: 500 }}
        >
          <Copy size={14} />
          Copy
        </button>
      </div>
    </div>
  );
}
