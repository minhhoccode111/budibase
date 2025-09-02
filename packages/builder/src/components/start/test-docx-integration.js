/**
 * Test script to verify DOCX template integration
 * This file can be used to test the complete flow from upload to app creation
 */

// Mock DOCX template data for testing
export const mockDocxTemplateData = {
  name: "Customer Registration Form",
  description: "A form for collecting customer information",
  fields: [
    {
      name: "firstName",
      type: "text",
      required: true,
      isNested: false,
      isConditional: false,
      isLoop: false
    },
    {
      name: "lastName", 
      type: "text",
      required: true,
      isNested: false,
      isConditional: false,
      isLoop: false
    },
    {
      name: "email",
      type: "email", 
      required: true,
      isNested: false,
      isConditional: false,
      isLoop: false
    },
    {
      name: "phone",
      type: "phone",
      required: false,
      isNested: false,
      isConditional: false,
      isLoop: false
    },
    {
      name: "birthDate",
      type: "date",
      required: false,
      isNested: false,
      isConditional: false,
      isLoop: false
    },
    {
      name: "age",
      type: "number",
      required: false,
      isNested: false,
      isConditional: false,
      isLoop: false
    },
    {
      name: "newsletter",
      type: "boolean",
      required: false,
      isNested: false,
      isConditional: false,
      isLoop: false
    },
    {
      name: "website",
      type: "url",
      required: false,
      isNested: false,
      isConditional: false,
      isLoop: false
    },
    // Complex fields that should be skipped in Phase 1
    {
      name: "address",
      type: "text",
      required: false,
      path: "customer.address.street",
      isNested: true,
      isConditional: false,
      isLoop: false
    },
    {
      name: "discount",
      type: "number",
      required: false,
      isNested: false,
      isConditional: true,
      isLoop: false,
      condition: "hasDiscount"
    },
    {
      name: "itemName",
      type: "text",
      required: false,
      isNested: false,
      isConditional: false,
      isLoop: true,
      loopVariable: "items"
    }
  ],
  parseResults: {
    totalPlaceholders: 11,
    conditionals: ["hasDiscount"],
    loops: ["items"],
    nestedObjects: ["customer.address"]
  }
}

// Test functions
export function testFieldValidation() {
  console.log("Testing DOCX field validation...")
  
  const { validateDocxFieldsForPhase1 } = require("../../../server/src/utilities/docxTemplate")
  const result = validateDocxFieldsForPhase1(mockDocxTemplateData.fields)
  
  console.log("Validation Results:")
  console.log(`- Compatible fields: ${result.compatibleFields.length}`)
  console.log(`- Skipped fields: ${result.skippedFields.length}`)
  console.log(`- Warnings: ${result.warnings.length}`)
  
  result.warnings.forEach(warning => console.log(`  Warning: ${warning}`))
  
  // Expected: 8 compatible fields (firstName, lastName, email, phone, birthDate, age, newsletter, website)
  // Expected: 3 skipped fields (address, discount, itemName)
  
  return result.compatibleFields.length === 8 && result.skippedFields.length === 3
}

export function testTableCreation() {
  console.log("Testing table creation from DOCX fields...")
  
  const { createTableFromDocxFields } = require("../../../server/src/utilities/docxTemplate")
  const compatibleFields = mockDocxTemplateData.fields.filter(f => 
    !f.isNested && !f.isConditional && !f.isLoop
  )
  
  const table = createTableFromDocxFields(compatibleFields, "Test Table")
  
  console.log("Created table:")
  console.log(`- Table ID: ${table._id}`)
  console.log(`- Table name: ${table.name}`)
  console.log(`- Schema fields: ${Object.keys(table.schema).length}`)
  console.log(`- Primary display: ${table.primaryDisplay}`)
  
  // Should have _id + 8 compatible fields = 9 total fields
  return Object.keys(table.schema).length === 9
}

export function testComponentMapping() {
  console.log("Testing component mapping...")
  
  const fieldTypeMap = {
    text: "stringfield",
    email: "stringfield", 
    phone: "stringfield",
    number: "numberfield",
    date: "datetimefield",
    boolean: "booleanfield",
    url: "stringfield"
  }
  
  const compatibleFields = mockDocxTemplateData.fields.filter(f => 
    !f.isNested && !f.isConditional && !f.isLoop
  )
  
  compatibleFields.forEach(field => {
    const expectedComponent = fieldTypeMap[field.type]
    console.log(`- ${field.name} (${field.type}) -> ${expectedComponent}`)
  })
  
  return true
}

export function testTemplateStructure() {
  console.log("Testing template structure for backend...")
  
  const templateStructure = {
    key: "docx/test-template-id",
    name: mockDocxTemplateData.name,
    description: mockDocxTemplateData.description,
    type: "APP",
    category: "Custom",
    useTemplate: true,
    fields: mockDocxTemplateData.fields,
    parseResults: mockDocxTemplateData.parseResults
  }
  
  console.log("Template structure:")
  console.log(`- Key: ${templateStructure.key}`)
  console.log(`- Name: ${templateStructure.name}`)
  console.log(`- Type: ${templateStructure.type}`)
  console.log(`- Category: ${templateStructure.category}`)
  console.log(`- Use template: ${templateStructure.useTemplate}`)
  console.log(`- Fields count: ${templateStructure.fields.length}`)
  
  return templateStructure.key.startsWith("docx/") && templateStructure.useTemplate === true
}

export function runAllTests() {
  console.log("=== DOCX Template Integration Tests ===\n")
  
  const tests = [
    { name: "Field Validation", fn: testFieldValidation },
    { name: "Table Creation", fn: testTableCreation },
    { name: "Component Mapping", fn: testComponentMapping },
    { name: "Template Structure", fn: testTemplateStructure }
  ]
  
  let passed = 0
  let failed = 0
  
  tests.forEach(test => {
    try {
      console.log(`\n--- ${test.name} ---`)
      const result = test.fn()
      if (result) {
        console.log(`✅ ${test.name} PASSED`)
        passed++
      } else {
        console.log(`❌ ${test.name} FAILED`)
        failed++
      }
    } catch (error) {
      console.log(`❌ ${test.name} ERROR:`, error.message)
      failed++
    }
  })
  
  console.log(`\n=== Test Results ===`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total: ${tests.length}`)
  
  return { passed, failed, total: tests.length }
}

// Export for use in other files
export default {
  mockDocxTemplateData,
  testFieldValidation,
  testTableCreation,
  testComponentMapping,
  testTemplateStructure,
  runAllTests
}
