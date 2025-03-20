import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Text,
  BlockStack,
  Select,
  TextField,
  Button,
  InlineStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useState } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  const [selectedField, setSelectedField] = useState('collection');
  const [selectedCondition, setSelectedCondition] = useState('is');
  const [filterValue, setFilterValue] = useState('');

  const fieldOptions = [
    { label: 'Collection', value: 'collection' },
    { label: 'Title', value: 'title' },
    { label: 'Product ID', value: 'productId' },
    { label: 'Description', value: 'description' },
    { label: 'Price', value: 'price' },
  ];

  const conditionOptions = [
    { label: 'is', value: 'is' },
    { label: 'contains', value: 'contains' },
    { label: "doesn't contain", value: 'doesNotContain' },
    { label: 'starts with', value: 'startsWith' },
    { label: 'ends with', value: 'endsWith' },
  ];

  const handlePreview = () => {
    // Handle preview logic here
    console.log({
      field: selectedField,
      condition: selectedCondition,
      value: filterValue
    });
  };

  return (
    <Page>
      <BlockStack gap="500">
        <Text variant="headingSm" as="h1">STEP 1: SELECT WHAT PRODUCTS TO EDIT</Text>
        <Text variant="headingSm" as="h3">Products must match all following conditions:</Text>
        
        <InlineStack gap="300" align="start" blockAlign="center">
          <Select
            label=""
            options={fieldOptions}
            value={selectedField}
            onChange={setSelectedField}
          />
          <Select
            label=""
            options={conditionOptions}
            value={selectedCondition}
            onChange={setSelectedCondition}
          />
          <div style={{ minWidth: '200px' }}>
            <TextField
              label=""
              value={filterValue}
              onChange={setFilterValue}
              autoComplete="off"
            />
          </div>
        </InlineStack>

        <InlineStack gap="300">
          <Button variant="primary" onClick={handlePreview}>
            Preview matching products
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}