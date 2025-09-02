# DOCX Template Integration Guide

## Overview
This guide explains how to use and extend the DOCX template functionality in Budibase.

## Supported Template Syntax

### Basic Fields
```
{{firstName}}        -> Text field
{{email}}           -> Email field (with validation)
{{phone}}           -> Phone field
{{age}}             -> Number field
{{birthDate}}       -> Date field
{{newsletter}}      -> Boolean field
{{website}}         -> URL field (with validation)
```

### Complex Syntax (Phase 2 - Future)
```
{{customer.name}}                    -> Nested object field
{{#if hasDiscount}}{{discount}}{{/if}} -> Conditional field
{{#each items}}{{name}}{{/each}}     -> Loop field
```

## Creating DOCX Templates

### 1. Template Structure
Create a Microsoft Word document (.docx) with your desired layout and include field placeholders using double curly braces:

```
Customer Registration Form

Name: {{firstName}} {{lastName}}
Email: {{email}}
Phone: {{phone}}
Birth Date: {{birthDate}}
Age: {{age}}
Subscribe to newsletter: {{newsletter}}
Website: {{website}}
```

### 2. Field Naming Best Practices
- Use camelCase for field names: `firstName`, `lastName`
- Include descriptive keywords for auto-type detection:
  - Email fields: `email`, `emailAddress`, `contactEmail`
  - Phone fields: `phone`, `telephone`, `mobile`
  - Date fields: `date`, `birthDate`, `createdDate`
  - Number fields: `age`, `count`, `amount`, `price`
  - Boolean fields: `isActive`, `hasDiscount`, `newsletter`
  - URL fields: `website`, `profileUrl`, `homepage`

### 3. Upload Process
1. Navigate to template selection in Budibase
2. Click "Add new template"
3. Upload your DOCX file
4. Review the parsed fields
5. Provide template name and description
6. Upload template

## API Usage

### Upload DOCX Template
```javascript
const formData = new FormData()
formData.append('file', docxFile)
formData.append('name', 'My Template')
formData.append('description', 'Template description')
formData.append('fields', JSON.stringify(parsedFields))
formData.append('parseResults', JSON.stringify(parseResults))

const response = await API.uploadDocxTemplate(formData)
```

### Create App from DOCX Template
```javascript
const template = {
  key: 'docx/template-id',
  useTemplate: true,
  name: 'My DOCX Template',
  // ... other template properties
}

await createApp(appName, template)
```

## Development

### Adding New Field Types
1. Update `DOCX_TO_BUDIBASE_TYPE_MAP` in `docxTemplate.ts`
2. Add detection logic in `inferFieldType()` function
3. Update component mapping in `DOCX_TO_COMPONENT_MAP`

### Extending Parser
The parser uses regular expressions to detect template syntax:
- `simpleField`: `/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g`
- `nestedField`: `/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)\s*\}\}/g`
- `conditional`: `/\{\{\s*#if\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*\/if\s*\}\}/g`

### Testing
Run the test suite:
```javascript
import { runAllTests } from './test-docx-integration.js'
runAllTests()
```

## Troubleshooting

### Common Issues
1. **File not parsing**: Ensure DOCX file is valid and contains text content
2. **Fields not detected**: Check field naming follows `{{fieldName}}` syntax
3. **Upload fails**: Verify file size is under 10MB and has .docx extension
4. **Type detection wrong**: Use more descriptive field names or manually adjust

### Debug Information
The system provides detailed parsing information:
- Total placeholders found
- Field types detected
- Skipped complex fields (Phase 1)
- Validation warnings

### Logs
Check browser console and server logs for detailed error information during upload and parsing.

## Future Enhancements (Phase 2)

### Planned Features
- Nested object support (`{{customer.address.street}}`)
- Conditional field rendering (`{{#if condition}}`)
- Loop/array field support (`{{#each items}}`)
- Custom field validation rules
- Template preview generation
- Bulk template import
- Template versioning
- Advanced field mapping UI

### Contributing
To contribute to DOCX template functionality:
1. Follow existing code patterns in `docxTemplate.ts`
2. Add comprehensive tests for new features
3. Update type definitions in `template.ts`
4. Document new syntax in this guide
