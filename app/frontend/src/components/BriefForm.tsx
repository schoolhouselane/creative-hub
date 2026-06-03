import { useState } from 'react';
import { type BriefType, type FormField, type BrandProfile, PRIORITY_OPTIONS } from '@/lib/briefTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Send, Loader2 } from 'lucide-react';

interface BriefFormProps {
  briefType: BriefType;
  selectedBrand?: BrandProfile | null;
  onSubmit: (data: Record<string, string>) => Promise<void>;
  isSubmitting?: boolean;
}

export default function BriefForm({ briefType, selectedBrand, onSubmit, isSubmitting }: BriefFormProps) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {
      title: '',
      project_description: '',
      priority: 'medium',
    };
    if (selectedBrand) {
      initial.brand_name = selectedBrand.brand_name;
      initial.tone_style = selectedBrand.tone_of_voice || '';
      initial.target_audience = '';
    }
    return initial;
  });

  const steps = [
    {
      title: 'Project Overview',
      fields: [
        { name: 'title', label: 'Brief Title', type: 'text' as const, placeholder: `e.g. ${briefType.label} for Q3 Campaign`, required: true },
        { name: 'brand_name', label: 'Brand / Client Name', type: 'text' as const, placeholder: 'Enter brand name', required: true },
        { name: 'project_description', label: 'Project Description', type: 'textarea' as const, placeholder: 'Describe the project goals, context, and deliverables...', required: true },
        { name: 'target_audience', label: 'Target Audience', type: 'textarea' as const, placeholder: 'Who is this for? e.g. 25–40 year old urban cyclists, interested in performance and lifestyle...', required: false },
        { name: 'tone_style', label: 'Tone / Visual Style', type: 'text' as const, placeholder: 'e.g. Bold and energetic, Minimal and elegant, Warm and approachable', required: false },
        { name: 'priority', label: 'Priority', type: 'select' as const, placeholder: 'Select priority', required: true, options: PRIORITY_OPTIONS.map((p) => p.label) },
      ] as FormField[],
    },
    {
      title: `${briefType.label} Details`,
      fields: briefType.formFields.slice(0, 3),
    },
    {
      title: 'Additional Details',
      fields: [
        ...briefType.formFields.slice(3),
        { name: 'additional_notes', label: 'Additional Notes', type: 'textarea' as const, placeholder: 'Any other requirements, references, or notes...', required: false },
      ] as FormField[],
    },
  ];

  const currentStep = steps[step];

  const handleFieldChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    await onSubmit(formData);
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || '';

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.name} className="space-y-2">
          <Label className="text-sm font-medium text-slate-300">
            {field.label}
            {field.required && <span className="ml-1 text-red-400">*</span>}
          </Label>
          <Select value={value} onValueChange={(v) => handleFieldChange(field.name, v)}>
            <SelectTrigger className="border-white/10 bg-white/5 text-white focus:border-violet-500 focus:ring-violet-500/20">
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#1a1a2e]">
              {field.options.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-white hover:bg-white/10 focus:bg-white/10">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.name} className="space-y-2">
          <Label className="text-sm font-medium text-slate-300">
            {field.label}
            {field.required && <span className="ml-1 text-red-400">*</span>}
          </Label>
          <Textarea
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className="min-h-[100px] border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20"
          />
        </div>
      );
    }

    return (
      <div key={field.name} className="space-y-2">
        <Label className="text-sm font-medium text-slate-300">
          {field.label}
          {field.required && <span className="ml-1 text-red-400">*</span>}
        </Label>
        <Input
          value={value}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          className="border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20"
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => setStep(i)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all ${
                i === step
                  ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30'
                  : i < step
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'bg-white/5 text-slate-500'
              }`}
            >
              {i + 1}
            </button>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-8 rounded ${i < step ? 'bg-violet-500/50' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
        <span className="ml-3 text-sm text-slate-400">{currentStep.title}</span>
      </div>

      {/* Brand auto-fill notice */}
      {selectedBrand && step === 0 && (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-2">
          <p className="text-xs text-violet-300">
            ✨ Auto-filled from brand profile: <strong>{selectedBrand.brand_name}</strong>
          </p>
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-5">
        {currentStep.fields.map(renderField)}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="ghost"
          onClick={handleBack}
          disabled={step === 0}
          className="gap-2 text-slate-400 hover:text-white hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {step < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            className="gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2 bg-gradient-to-r from-violet-600 to-emerald-600 text-white hover:from-violet-500 hover:to-emerald-500"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit Brief
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}