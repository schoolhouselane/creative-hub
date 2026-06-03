export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect';
  placeholder: string;
  required: boolean;
  options?: string[];
}

export interface BriefType {
  id: string;
  label: string;
  description: string;
  icon: string;
  image: string;
  color: string;
  formFields: FormField[];
}

export interface AITool {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  model?: string;
}

export interface Brief {
  id: number;
  user_id: string;
  brief_type: string;
  title: string;
  status: string;
  brand_name: string;
  project_description: string;
  target_audience: string;
  tone_style: string;
  dimensions: string;
  platform: string;
  key_message: string;
  additional_notes: string;
  form_data: string;
  ai_tool: string;
  generated_asset_url: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface BrandDNA {
  brand_name?: string;
  tagline?: string;
  industry?: string;
  brand_story?: string;
  target_audience?: string;
  brand_personality?: string[];
  brand_values?: string[];
  tone_of_voice?: string;
  writing_style?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    additional?: string[];
  };
  typography?: {
    heading_font?: string;
    body_font?: string;
    accent_font?: string;
    type_rules?: string;
  };
  logo?: {
    description?: string;
    usage_rules?: string;
    clear_space?: string;
  };
  imagery_style?: {
    photography_direction?: string;
    subjects?: string;
    mood?: string;
    lighting?: string;
    composition?: string;
    color_treatment?: string;
    what_to_avoid?: string;
  };
  design_rules?: {
    layout_principles?: string;
    dos?: string[];
    donts?: string[];
  };
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  font_heading?: string;
  font_body?: string;
  guidelines_notes?: string;
}

export interface BrandProfile {
  id: number;
  user_id: string;
  brand_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  tone_of_voice: string;
  logo_url: string;
  tagline: string;
  industry: string;
  guidelines_notes: string;
  brand_dna?: string;
}

export const BRIEF_TYPES: BriefType[] = [
  {
    id: 'design',
    label: 'Design Brief',
    description: 'Logos, Identity, Print, Packaging',
    icon: 'Palette',
    image: 'https://mgx-backend-cdn.metadl.com/generate/images/1219469/2026-05-12/ompirmiaagoq/design-brief-icon.png',
    color: '#a855f7',
    formFields: [
      { name: 'logo_type', label: 'Logo Type', type: 'select', placeholder: 'Select logo type', required: true, options: ['Wordmark', 'Lettermark', 'Icon', 'Combination', 'Emblem', 'Abstract'] },
      { name: 'brand_colors', label: 'Brand Colors', type: 'text', placeholder: 'e.g. #7c3aed, #06b6d4, #f59e0b', required: false },
      { name: 'style_direction', label: 'Style Direction', type: 'select', placeholder: 'Select style', required: true, options: ['Minimal', 'Bold', 'Elegant', 'Playful', 'Corporate', 'Vintage', 'Futuristic'] },
      { name: 'dimensions', label: 'Dimensions', type: 'text', placeholder: 'e.g. 1080x1080, A4, Business Card', required: false },
      { name: 'usage_context', label: 'Usage Context', type: 'select', placeholder: 'Where will this be used?', required: true, options: ['Web', 'Print', 'Social Media', 'Packaging', 'All'] },
      { name: 'reference_links', label: 'Reference / Inspiration', type: 'textarea', placeholder: 'Links or descriptions of designs you like...', required: false },
    ],
  },
  {
    id: 'ads',
    label: 'Ads Brief',
    description: 'Meta, Google, Display, Billboard',
    icon: 'Megaphone',
    image: 'https://mgx-backend-cdn.metadl.com/generate/images/1219469/2026-05-12/ompisqaaagqq/ads-brief-icon.png',
    color: '#06b6d4',
    formFields: [
      { name: 'platform', label: 'Ad Platform', type: 'select', placeholder: 'Select platform', required: true, options: ['Meta (Facebook/Instagram)', 'Google Ads', 'Display Network', 'Billboard/OOH', 'YouTube', 'LinkedIn Ads', 'TikTok Ads'] },
      { name: 'ad_format', label: 'Ad Format', type: 'select', placeholder: 'Select format', required: true, options: ['Static Image', 'Carousel', 'Video', 'Story/Reel', 'Banner', 'Native'] },
      { name: 'cta_text', label: 'Call to Action', type: 'text', placeholder: 'e.g. Shop Now, Learn More, Sign Up', required: true },
      { name: 'target_audience', label: 'Target Audience', type: 'textarea', placeholder: 'Describe your target audience demographics and interests...', required: true },
      { name: 'key_message', label: 'Key Message', type: 'textarea', placeholder: 'What is the main message of this ad?', required: true },
      { name: 'dimensions', label: 'Dimensions', type: 'text', placeholder: 'e.g. 1080x1080, 1200x628, 1080x1920', required: false },
    ],
  },
  {
    id: 'social',
    label: 'Social Post Brief',
    description: 'Instagram, LinkedIn, TikTok',
    icon: 'Share2',
    image: 'https://mgx-backend-cdn.metadl.com/generate/images/1219469/2026-05-12/ompipcqaagqa/social-brief-icon.png',
    color: '#ec4899',
    formFields: [
      { name: 'platform', label: 'Platform', type: 'select', placeholder: 'Select platform', required: true, options: ['Instagram', 'LinkedIn', 'TikTok', 'Twitter/X', 'Facebook', 'Pinterest'] },
      { name: 'post_type', label: 'Post Type', type: 'select', placeholder: 'Select post type', required: true, options: ['Feed Post', 'Story', 'Reel/Short', 'Carousel', 'Cover Image', 'Profile Banner'] },
      { name: 'caption_tone', label: 'Caption Tone', type: 'select', placeholder: 'Select tone', required: true, options: ['Professional', 'Casual', 'Humorous', 'Inspirational', 'Educational', 'Provocative'] },
      { name: 'hashtags', label: 'Hashtags', type: 'text', placeholder: '#design #creative #branding', required: false },
      { name: 'visual_style', label: 'Visual Style', type: 'textarea', placeholder: 'Describe the visual style you want...', required: false },
      { name: 'caption_draft', label: 'Caption Draft / Notes', type: 'textarea', placeholder: 'Any caption ideas or key points to include...', required: false },
    ],
  },
  {
    id: 'email',
    label: 'Email Brief',
    description: 'Campaigns, Newsletters, Sequences',
    icon: 'Mail',
    image: 'https://mgx-backend-cdn.metadl.com/generate/images/1219469/2026-05-12/ompjdxqaagpq/email-brief-icon.png',
    color: '#10b981',
    formFields: [
      { name: 'email_type', label: 'Email Type', type: 'select', placeholder: 'Select email type', required: true, options: ['Campaign', 'Newsletter', 'Welcome Series', 'Abandoned Cart', 'Re-engagement', 'Product Launch', 'Event Invitation'] },
      { name: 'subject_line', label: 'Subject Line Direction', type: 'text', placeholder: 'Suggested subject line or direction...', required: true },
      { name: 'audience_segment', label: 'Audience Segment', type: 'text', placeholder: 'e.g. New subscribers, VIP customers, Leads', required: true },
      { name: 'cta_text', label: 'Primary CTA', type: 'text', placeholder: 'e.g. Shop Now, Read More, Register', required: true },
      { name: 'email_sections', label: 'Email Sections / Content', type: 'textarea', placeholder: 'Describe the sections and content blocks...', required: false },
      { name: 'preheader', label: 'Preheader Text', type: 'text', placeholder: 'Preview text shown in inbox...', required: false },
    ],
  },
  {
    id: 'content',
    label: 'Content Brief',
    description: 'Blog, Web Copy, Descriptions',
    icon: 'FileText',
    image: 'https://mgx-backend-cdn.metadl.com/generate/images/1219469/2026-05-12/ompjfjiaagoq/content-brief-icon.png',
    color: '#f59e0b',
    formFields: [
      { name: 'content_type', label: 'Content Type', type: 'select', placeholder: 'Select content type', required: true, options: ['Blog Post', 'Web Copy', 'Product Description', 'Case Study', 'Whitepaper', 'Landing Page Copy', 'SEO Article'] },
      { name: 'word_count', label: 'Word Count', type: 'select', placeholder: 'Select word count', required: true, options: ['300 words', '500 words', '1000 words', '2000 words', '3000+ words'] },
      { name: 'seo_keywords', label: 'SEO Keywords', type: 'text', placeholder: 'Primary and secondary keywords...', required: false },
      { name: 'tone', label: 'Writing Tone', type: 'select', placeholder: 'Select tone', required: true, options: ['Professional', 'Conversational', 'Technical', 'Persuasive', 'Educational', 'Storytelling'] },
      { name: 'outline', label: 'Content Outline / Key Points', type: 'textarea', placeholder: 'Outline the main sections or key points to cover...', required: true },
      { name: 'reference_content', label: 'Reference Content', type: 'textarea', placeholder: 'Links or examples of similar content...', required: false },
    ],
  },
  {
    id: 'video',
    label: 'Video Brief',
    description: 'Reels, Ads, HeyGen, ElevenLabs',
    icon: 'Video',
    image: 'https://mgx-backend-cdn.metadl.com/generate/images/1219469/2026-05-12/ompjgiiaagpa/video-brief-icon.png',
    color: '#ef4444',
    formFields: [
      { name: 'video_type', label: 'Video Type', type: 'select', placeholder: 'Select video type', required: true, options: ['Reel/Short', 'Ad Spot', 'Explainer', 'Testimonial', 'Product Demo', 'Brand Story', 'Tutorial'] },
      { name: 'duration', label: 'Duration', type: 'select', placeholder: 'Select duration', required: true, options: ['15 seconds', '30 seconds', '60 seconds', '2 minutes', '5 minutes', '10+ minutes'] },
      { name: 'script_concept', label: 'Script / Concept', type: 'textarea', placeholder: 'Describe the video concept, script, or storyboard...', required: true },
      { name: 'voiceover_needs', label: 'Voiceover', type: 'select', placeholder: 'Select voiceover option', required: true, options: ['None', 'Male Voice', 'Female Voice', 'AI Voice (ElevenLabs)', 'Multiple Voices'] },
      { name: 'music_style', label: 'Music Style', type: 'select', placeholder: 'Select music style', required: false, options: ['Upbeat', 'Corporate', 'Cinematic', 'Ambient', 'Electronic', 'Acoustic', 'None'] },
      { name: 'aspect_ratio', label: 'Aspect Ratio', type: 'select', placeholder: 'Select aspect ratio', required: false, options: ['9:16 (Vertical)', '16:9 (Horizontal)', '1:1 (Square)', '4:5 (Portrait)'] },
    ],
  },
];

export const AI_TOOLS: AITool[] = [
  // Image
  { id: 'gpt-image', name: 'GPT Image', description: 'AI image generation with sharp detail and fast rendering', category: 'image', icon: '🎨', model: 'gpt-image-2' },
  { id: 'gemini-image', name: 'Gemini Image', description: 'Best quality image generation with precise text rendering', category: 'image', icon: '✨', model: 'gemini-3-pro-image-preview' },
  // Text — Claude
  { id: 'claude-sonnet', name: 'Claude Sonnet 4.6', description: 'Anthropic — best balance of intelligence and speed for creative work', category: 'text', icon: '🤖', model: 'claude-sonnet-4-6' },
  { id: 'claude-opus', name: 'Claude Opus 4.7', description: 'Anthropic — most powerful model for complex briefs and long-form copy', category: 'text', icon: '🧠', model: 'claude-opus-4-7' },
  { id: 'claude-haiku', name: 'Claude Haiku 4.5', description: 'Anthropic — fastest model, ideal for captions and quick drafts', category: 'text', icon: '⚡', model: 'claude-haiku-4-5-20251001' },
  // Text — other
  { id: 'gpt-text', name: 'GPT-5.4', description: 'OpenAI — versatile text generation for copy, scripts, and content', category: 'text', icon: '📝', model: 'gpt-5.4' },
  { id: 'deepseek', name: 'DeepSeek V3', description: 'Cost-effective text generation for bulk processing', category: 'text', icon: '🔮', model: 'deepseek-v3.2' },
  // Audio
  { id: 'elevenlabs', name: 'ElevenLabs', description: 'High-quality text-to-speech in 70+ languages', category: 'audio', icon: '🎙️', model: 'eleven_v3' },
  // Video
  { id: 'wan-video', name: 'Wan Video', description: 'Text-to-video generation up to 15 seconds', category: 'video', icon: '🎬', model: 'wan2.6-t2v' },
  { id: 'veo-video', name: 'Veo 3.1', description: 'High quality cinematic video generation', category: 'video', icon: '🎥', model: 'veo-3.1-generate-001' },
];

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#94a3b8' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

export const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: '#7c3aed' },
  { value: 'in_progress', label: 'In Progress', color: '#06b6d4' },
  { value: 'completed', label: 'Completed', color: '#10b981' },
  { value: 'revision', label: 'Revision', color: '#f59e0b' },
];

export function getBriefType(id: string): BriefType | undefined {
  return BRIEF_TYPES.find((t) => t.id === id);
}

export function getAIToolsForBriefType(briefTypeId: string): AITool[] {
  const categoryMap: Record<string, string[]> = {
    design: ['image'],
    ads: ['image', 'text'],
    social: ['image', 'text'],
    email: ['text'],
    content: ['text'],
    video: ['video', 'audio', 'text'],
  };
  const categories = categoryMap[briefTypeId] || [];
  return AI_TOOLS.filter((tool) => categories.includes(tool.category));
}

export const EXTERNAL_TOOLS = [
  { id: 'midjourney', name: 'Midjourney', type: 'Image', icon: '🎭', url: 'https://www.midjourney.com/imagine', desc: 'Artistic & cinematic image generation' },
  { id: 'freepik', name: 'Freepik AI', type: 'Image', icon: '🖼️', url: 'https://www.freepik.com/ai/image-generator', desc: 'Design assets & illustrations' },
  { id: 'higgsfield', name: 'Higgsfield', type: 'Video', icon: '🎞️', url: 'https://higgsfield.ai', desc: 'Cinematic AI video & motion' },
  { id: 'heygen', name: 'HeyGen', type: 'Video', icon: '🎬', url: 'https://app.heygen.com', desc: 'AI avatar videos & presentations' },
  { id: 'figma', name: 'Figma', type: 'Design', icon: '🖌️', url: 'https://figma.com', desc: 'Design & brand guidelines' },
];