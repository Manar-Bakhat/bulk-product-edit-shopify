import { useState, useEffect } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  Frame,
  BlockStack,
  Box,
  Button,
  TextField,
  DataTable,
  EmptyState,
  LegacyCard,
  Select,
  InlineStack,
  Icon,
  Divider,
  Banner,
  Spinner,
  Badge,
  ProgressBar,
  Pagination,
  Toast
} from "@shopify/polaris";
import { Sidebar } from "../components/Sidebar";
import { FilterIcon, EditIcon, ResetIcon } from '@shopify/polaris-icons';
import { useSearchParams, useNavigate } from "@remix-run/react";

interface Product {
  id: string;
  title: string;
  description: string;
  productType: string;
  vendor: string;
  status: string;
  featuredImage?: {
    url: string;
    altText?: string;
  };
  priceRangeV2: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
}

export default function BulkEdit() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState("title");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get("section") || "title";
  const [selectedField, setSelectedField] = useState('title');
  const [selectedCondition, setSelectedCondition] = useState('contains');
  const [filterValue, setFilterValue] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedEditOption, setSelectedEditOption] = useState('');
  const [textToAdd, setTextToAdd] = useState('');
  const [textToReplace, setTextToReplace] = useState('');
  const [replacementText, setReplacementText] = useState('');
  const [capitalizationType, setCapitalizationType] = useState('titleCase');
  const [numberOfCharacters, setNumberOfCharacters] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  useEffect(() => {
    setActiveSection(section);
  }, [section]);

  const handleSidebarChange = (expanded: boolean) => {
    setIsSidebarExpanded(expanded);
  };

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    if (section === "home") {
      navigate("/app/dashboard");
    } else if (section === "title" || section === "price") {
      navigate(`/app/bulkEdit?section=${section}`);
    }
  };

  const renderTitleContent = () => (
    <BlockStack gap="500">
      {/* Progress Indicator */}
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Badge tone="success">Step 1 of 2</Badge>
          <ProgressBar progress={50} tone="success" />
        </InlineStack>
      </BlockStack>

      {/* Filter Section */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Icon source={FilterIcon} tone="success" />
              <Text variant="headingSm" as="h2">Filter Products</Text>
            </InlineStack>
            <Button
              icon={ResetIcon}
              onClick={() => {}}
              disabled={!hasSearched}
              tone="success"
            >
              Clear filters
            </Button>
          </InlineStack>
          <Divider />
          
          <BlockStack gap="400">
            <InlineStack gap="300" align="start" blockAlign="center">
              <Select
                label=""
                options={[
                  { label: 'Title', value: 'title' },
                  { label: 'Description', value: 'description' },
                  { label: 'Product ID', value: 'productId' }
                ]}
                value={selectedField}
                onChange={setSelectedField}
              />
              <Select
                label=""
                options={[
                  { label: 'is', value: 'is' },
                  { label: 'contains', value: 'contains' },
                  { label: 'does not contain', value: 'doesNotContain' },
                  { label: 'starts with', value: 'startsWith' },
                  { label: 'ends with', value: 'endsWith' }
                ]}
                value={selectedCondition}
                onChange={setSelectedCondition}
              />
              <div style={{ minWidth: '200px' }}>
                <TextField
                  label=""
                  value={filterValue}
                  onChange={setFilterValue}
                  autoComplete="off"
                  placeholder="Enter search text..."
                />
              </div>
            </InlineStack>

            <InlineStack gap="300">
              <Button variant="primary" onClick={() => {}} loading={isLoading} tone="success">
                Preview matching products
              </Button>
            </InlineStack>

            {hasSearched && (
              <div style={{ position: 'relative' }}>
                {isLoading && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'var(--p-color-bg-surface)',
                    opacity: 0.8,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1
                  }}>
                    <Spinner size="large" />
                  </div>
                )}
                
                {products.length > 0 ? (
                  <BlockStack gap="400">
                    <DataTable
                      columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                      headings={['Product', 'Description', 'Product Type', 'Status', 'Price']}
                      rows={[]}
                      hoverable
                      defaultSortDirection="descending"
                      initialSortColumnIndex={0}
                    />
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                      <Pagination
                        label={`Page ${currentPage} of ${Math.ceil(products.length / itemsPerPage)}`}
                        hasPrevious={currentPage > 1}
                        onPrevious={() => setCurrentPage(currentPage - 1)}
                        hasNext={currentPage < Math.ceil(products.length / itemsPerPage)}
                        onNext={() => setCurrentPage(currentPage + 1)}
                      />
                    </div>
                  </BlockStack>
                ) : !isLoading && (
                  <Banner tone="success">
                    No products found matching your criteria
                  </Banner>
                )}
              </div>
            )}
          </BlockStack>
        </BlockStack>
      </Card>

      {/* Progress Indicator for Step 2 */}
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Badge tone="success">Step 2 of 2</Badge>
          <ProgressBar progress={100} tone="success" />
        </InlineStack>
      </BlockStack>

      {/* Edit Section */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Icon source={EditIcon} tone="success" />
              <Text variant="headingSm" as="h2">Edit Products</Text>
            </InlineStack>
          </InlineStack>
          <Divider />

          <BlockStack gap="400">
            <Select
              label=""
              options={[
                { label: 'Add text at the beginning of title', value: 'addTextBeginning' },
                { label: 'Add text to the end of title', value: 'addTextEnd' },
                { label: 'Find and remove text from title', value: 'removeText' },
                { label: 'Find and replace text in title', value: 'replaceText' },
                { label: 'Change title capitalization', value: 'capitalize' },
                { label: 'Keep the first X number of characters', value: 'truncate' }
              ]}
              value={selectedEditOption}
              onChange={setSelectedEditOption}
              placeholder="Select an option"
            />
            
            {(selectedEditOption === 'addTextBeginning' || selectedEditOption === 'addTextEnd' || selectedEditOption === 'removeText' || selectedEditOption === 'replaceText' || selectedEditOption === 'capitalize' || selectedEditOption === 'truncate') && (
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">
                  {selectedEditOption === 'removeText' ? 'Remove' : 
                   selectedEditOption === 'replaceText' ? 'Replace' : 
                   selectedEditOption === 'capitalize' ? 'Capitalize' : 
                   selectedEditOption === 'truncate' ? 'Truncate' : 'Add'}
                </Text>
                <div style={{ maxWidth: '400px' }}>
                  {selectedEditOption === 'replaceText' ? (
                    <BlockStack gap="400">
                      <TextField
                        label="Find"
                        value={textToReplace}
                        onChange={setTextToReplace}
                        placeholder="Enter text to find"
                        autoComplete="off"
                      />
                      <TextField
                        label="Replace with"
                        value={replacementText}
                        onChange={setReplacementText}
                        placeholder="Enter replacement text"
                        autoComplete="off"
                      />
                    </BlockStack>
                  ) : selectedEditOption === 'capitalize' ? (
                    <BlockStack gap="400">
                      <Select
                        label="Capitalization type"
                        options={[
                          { label: 'First Letter Of Each Word Is Uppercase', value: 'titleCase' },
                          { label: 'UPPERCASE', value: 'uppercase' },
                          { label: 'lowercase', value: 'lowercase' },
                          { label: 'First letter of title uppercase', value: 'firstLetter' }
                        ]}
                        value={capitalizationType}
                        onChange={setCapitalizationType}
                      />
                    </BlockStack>
                  ) : selectedEditOption === 'truncate' ? (
                    <BlockStack gap="400">
                      <TextField
                        label="Number of characters"
                        type="number"
                        value={numberOfCharacters}
                        onChange={setNumberOfCharacters}
                        placeholder="Enter number of characters to keep"
                        autoComplete="off"
                      />
                    </BlockStack>
                  ) : (
                    <TextField
                      label=""
                      value={textToAdd}
                      onChange={setTextToAdd}
                      placeholder={
                        selectedEditOption === 'removeText'
                          ? 'Enter text to remove from titles'
                          : `Enter text to add ${selectedEditOption === 'addTextBeginning' ? 'at the beginning' : 'to the end'} of titles`
                      }
                      autoComplete="off"
                    />
                  )}
                </div>
                <Button variant="primary" onClick={() => {}} tone="success">
                  Start bulk edit now
                </Button>
              </BlockStack>
            )}
          </BlockStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );

  const renderPriceContent = () => (
    <BlockStack gap="400">
      <LegacyCard>
        <BlockStack gap="400">
          <Box padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Bulk Edit Price</Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Modify prices for multiple products simultaneously. Apply percentage changes,
                fixed amounts, or set specific prices.
              </Text>
              <TextField
                label="Price Adjustment"
                type="number"
                prefix="$"
                helpText="Enter a positive number to increase prices, negative to decrease"
                autoComplete="off"
              />
              <Box>
                <Button variant="primary">Calculate New Prices</Button>
              </Box>
            </BlockStack>
          </Box>
        </BlockStack>
      </LegacyCard>

      <LegacyCard>
        <BlockStack gap="400">
          <Box padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Products to Update</Text>
              <DataTable
                columnContentTypes={["text", "numeric", "numeric"]}
                headings={["Product", "Current Price", "New Price"]}
                rows={[]}
              />
              <EmptyState
                heading="No products selected"
                image=""
              >
                <p>Select products to update their prices</p>
              </EmptyState>
            </BlockStack>
          </Box>
        </BlockStack>
      </LegacyCard>
    </BlockStack>
  );

  const renderContent = () => {
    switch (activeSection) {
      case "title":
        return renderTitleContent();
      case "price":
        return renderPriceContent();
      default:
        return null;
    }
  };

  return (
    <Frame>
      <Sidebar
        onExpandedChange={handleSidebarChange}
        onSectionChange={handleSectionChange}
        activeSection={activeSection}
      />
      <div
        style={{
          marginLeft: isSidebarExpanded ? "240px" : "60px",
          transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          padding: "20px"
        }}
      >
        <Page>
          <Layout>
            <Layout.Section>
              {renderContent()}
            </Layout.Section>
          </Layout>
        </Page>
      </div>
    </Frame>
  );
}