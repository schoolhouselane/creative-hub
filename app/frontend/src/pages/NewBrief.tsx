import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import SidebarLayout from '@/components/Sidebar';
import BriefForm from '@/components/BriefForm';
import BrandProfile from '@/components/BrandProfile';
import { BRIEF_TYPES, type BriefType, type BrandProfile as BrandProfileType, PRIORITY_OPTIONS } from '@/lib/briefTypes';
import { toast } from 'sonner';
import { ArrowLeft, Palette, Megaphone, Share2, Mail, FileText, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';

const client = createClient();

const iconMap: Record<string, React.ElementType> = {
  Palette, Megaphone, Share2, Mail, FileText, Video,
};

export default function NewBrief() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedType = searchParams.get('type');

  const [user, setUser] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<BriefType | null>(
    preselectedType ? BRIEF_TYPES.find((t) => t.id === preselectedType) || null : null
  );
  const [selectedBrand, setSelectedBrand] = useState<BrandProfileType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await client.auth.me();
        setUser(res?.data || null);
      } catch {
        setUser(null);
      }
    };
    checkAuth();
  }, []);

  const handleSubmit = async (formData: Record<string, string>) => {
    if (!user) {
      toast.error('Please sign in to submit a brief');
      client.auth.toLogin();
      return;
    }

    if (!selectedType) return;

    setIsSubmitting(true);
    try {
      const priorityMap: Record<string, string> = {};
      PRIORITY_OPTIONS.forEach((p) => { priorityMap[p.label] = p.value; });

      const briefData = {
        brief_type: selectedType.id,
        title: formData.title || `${selectedType.label} Brief`,
        status: 'new',
        brand_name: formData.brand_name || '',
        project_description: formData.project_description || '',
        target_audience: formData.target_audience || '',
        tone_style: formData.tone_style || '',
        dimensions: formData.dimensions || '',
        platform: formData.platform || '',
        key_message: formData.key_message || formData.cta_text || '',
        additional_notes: formData.additional_notes || '',
        form_data: JSON.stringify(formData),
        ai_tool: '',
        generated_asset_url: '',
        priority: priorityMap[formData.priority] || formData.priority || 'medium',
      };

      const res = await client.entities.briefs.create({ data: briefData });
      const briefId = res?.data?.id;
      toast.success('Brief submitted successfully!');
      navigate(briefId ? `/briefs/${briefId}` : '/briefs');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit brief');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Type selection view
  if (!selectedType) {
    return (
      <SidebarLayout>
        <div className="min-h-full bg-[#f5f3ef] p-6 lg:p-8">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate('/briefs')}
              className="mb-4 gap-2 text-[#595959] hover:text-[#1e1e20] hover:bg-[#f5f3ef]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Briefs
            </Button>
            <h1 className="text-2xl font-bold text-[#1e1e20]">Create New Brief</h1>
            <p className="mt-1 text-sm text-[#595959]">Select the type of asset you need</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BRIEF_TYPES.map((type) => {
              const Icon = iconMap[type.icon] || Palette;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type)}
                  className="group rounded-xl border border-[#e2e2e2] bg-white p-5 text-left transition-all duration-300 hover:border-[#e2e2e2] hover:-translate-y-0.5"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${type.color}15` }}
                    >
                      <Icon className="h-6 w-6" style={{ color: type.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1e1e20]">{type.label}</h3>
                      <p className="text-xs text-[#595959]">{type.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium" style={{ color: type.color }}>
                    Select
                    <ArrowLeft className="h-3 w-3 rotate-180 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SidebarLayout>
    );
  }

  const TypeIcon = iconMap[selectedType.icon] || Palette;

  return (
    <SidebarLayout>
      <div className="min-h-full bg-[#f5f3ef] p-6 lg:p-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setSelectedType(null)}
            className="mb-4 gap-2 text-[#595959] hover:text-[#1e1e20] hover:bg-[#f5f3ef]"
          >
            <ArrowLeft className="h-4 w-4" />
            Change Brief Type
          </Button>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${selectedType.color}15` }}
            >
              <TypeIcon className="h-5 w-5" style={{ color: selectedType.color }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1e1e20]">{selectedType.label}</h1>
              <p className="text-sm text-[#595959]">{selectedType.description}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="rounded-xl border border-[#e2e2e2] bg-white p-6">
            <BriefForm
              briefType={selectedType}
              selectedBrand={selectedBrand}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          </div>

          <aside className="space-y-6">
            <BrandProfile
              onSelectBrand={(brand) => setSelectedBrand(brand)}
              selectedBrandId={selectedBrand?.id}
            />
          </aside>
        </div>
      </div>
    </SidebarLayout>
  );
}