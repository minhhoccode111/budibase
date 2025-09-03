# DOCX Template Fallback Background Image Feature

## Overview
This feature provides a professional-looking fallback background image for DOCX templates that don't have custom background images in the Budibase template selection modal.

## Implementation Details

### Files Modified
- `packages/builder/src/components/start/TemplatesModal.svelte`

### Key Features

#### 1. **Automatic Fallback Detection**
```typescript
const getTemplateImage = (template: TemplateMetadata): string => {
  // For DOCX templates without an image, use the custom document fallback
  if (
    template.key?.startsWith("docx/") &&
    (!template.image || template.image.trim() === "")
  ) {
    return createDocxFallbackImage()
  }
  // For all other templates, use the original image
  return template.image
}
```

#### 2. **Custom SVG Document Pattern**
The fallback image is generated using an SVG data URL that creates a document-like appearance:
- **Background**: Light gray with subtle line patterns
- **Content**: Simulated text lines in various lengths
- **Header**: Blue accent line to represent a title
- **Icon**: Small document icon in the corner
- **Colors**: Uses Budibase brand colors (#4285f4)

#### 3. **Visual Distinction**
DOCX templates get special styling:
- **Badge**: "DOCX" label in the top-right corner
- **Color**: Blue background matching the brand
- **Typography**: Small, bold, uppercase text

### CSS Styling
```css
.template-wrapper.docx-template::before {
  content: "DOCX";
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(66, 133, 244, 0.9);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  z-index: 5;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

## Usage

### For Users
1. **Upload DOCX Template**: When you upload a DOCX template without providing a custom background image
2. **View Templates**: Open the template selection modal by clicking "View templates"
3. **See Fallback**: DOCX templates without images will automatically display the document-pattern fallback
4. **Visual Identification**: Look for the "DOCX" badge to identify DOCX templates

### For Developers
The fallback is automatically applied based on:
- **Template Key**: Must start with "docx/"
- **Image Property**: Must be empty or whitespace-only
- **Template Type**: Works with any DOCX template metadata

## Benefits

### 1. **Professional Appearance**
- No more blank or broken image placeholders
- Consistent visual representation for DOCX templates
- Document-like pattern that clearly indicates the template type

### 2. **User Experience**
- Easy identification of DOCX templates vs regular Budibase templates
- Visual consistency across the template selection interface
- Clear indication of template source and type

### 3. **Maintainability**
- Self-contained SVG generation (no external image dependencies)
- Automatic application based on template properties
- Easy to modify colors and patterns

## Technical Details

### SVG Pattern Structure
```xml
<svg width="200" height="140" xmlns="http://www.w3.org/2000/svg">
  <!-- Line pattern background -->
  <pattern id="lines" patternUnits="userSpaceOnUse" width="200" height="20">
    <rect width="200" height="20" fill="#f8f9fa"/>
    <rect x="20" y="16" width="160" height="2" fill="#e9ecef"/>
  </pattern>
  
  <!-- Document content simulation -->
  <rect width="200" height="140" fill="url(#lines)"/>
  <rect x="20" y="20" width="120" height="3" fill="#4285f4"/> <!-- Title -->
  <!-- Multiple text lines with varying lengths -->
  
  <!-- Document icon -->
  <circle cx="170" cy="30" r="8" fill="#4285f4" opacity="0.2"/>
  <path d="M166 26 l8 8 M174 26 l-8 8" stroke="#4285f4" stroke-width="2" opacity="0.6"/>
</svg>
```

### Data URL Encoding
The SVG is converted to a base64 data URL for direct embedding:
```typescript
return `data:image/svg+xml;base64,${btoa(svg)}`
```

## Future Enhancements

### Potential Improvements
1. **Custom Icons**: Different icons based on template content type
2. **Color Themes**: Template-specific color schemes
3. **Preview Generation**: Actual document preview thumbnails
4. **Animation**: Subtle loading or hover animations
5. **Customization**: User-defined fallback patterns

### Integration Points
- Template upload process could generate custom previews
- Template metadata could include preview generation settings
- Admin interface could allow fallback pattern customization

## Testing

### Manual Testing Steps
1. Upload a DOCX template without providing a background image
2. Navigate to template selection modal
3. Verify the fallback image appears with document pattern
4. Confirm the "DOCX" badge is visible
5. Test with templates that have custom images (should not use fallback)

### Expected Results
- ✅ DOCX templates without images show document pattern
- ✅ DOCX templates with images use provided images
- ✅ Regular templates are unaffected
- ✅ "DOCX" badge appears on DOCX templates
- ✅ Visual consistency across the interface
