export interface TemplateSection {
  type: string;
  label: string;
  content: string;
  variables: string[];
}

export interface ParsedTemplateContent {
  variables: string[];
  sections: TemplateSection[];
  templateString: string;
}

export interface ParsedTemplateBlock {
  type: 'default' | 'optional';
  label?: string;
  content: ParsedTemplateContent;
}

export interface TemplateDefinition {
  text: string;
  subjectPrefix: string | null;
  code: string;
}

export interface DOMTreeInspectorOptions {
  doc?: Document;
  targetElement?: HTMLElement | null;
  onChange?: () => void;
}

export interface HostEnvironment {
  doc: Document;
  win: Window;
}