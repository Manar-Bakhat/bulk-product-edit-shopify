import { useState } from "react";
import {
  Box,
  Card,
  Layout,
  Link,
  List,
  Page,
  Text,
  BlockStack,
  Frame,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { Sidebar } from "../components/Sidebar";

export default function AdditionalPage() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const handleSidebarChange = (expanded: boolean) => {
    setIsSidebarExpanded(expanded);
  };

  return (
    <Frame>
      <Sidebar onExpandedChange={handleSidebarChange} />
      <div 
        style={{ 
          marginLeft: isSidebarExpanded ? '240px' : '60px',
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          padding: '20px'
        }}
      >
        <Page>
          <BlockStack gap="500">
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">
                      Bulk Edit Dashboard
                    </Text>
                    <Text as="p" variant="bodyMd">
                      Welcome to the bulk edit dashboard. Use the sidebar navigation to access different editing tools and features.
                    </Text>
                    <Box
                      background="bg-surface-secondary"
                      borderRadius="200"
                      padding="400"
                    >
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm">
                          Quick Tips:
                        </Text>
                        <ul style={{ paddingLeft: '20px' }}>
                          <li>
                            <Text as="p" variant="bodyMd">
                              Hover over the sidebar to expand it
                            </Text>
                          </li>
                          <li>
                            <Text as="p" variant="bodyMd">
                              Click on any tool to start editing
                            </Text>
                          </li>
                          <li>
                            <Text as="p" variant="bodyMd">
                              Use the search function to filter products
                            </Text>
                          </li>
                        </ul>
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section secondary>
                <BlockStack gap="400">
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingSm">
                        Recent Activity
                      </Text>
                      <Box
                        borderColor="border"
                        borderWidth="025"
                        borderRadius="200"
                        padding="300"
                      >
                        <Text as="p" variant="bodySm" tone="subdued">
                          No recent activity
                        </Text>
                      </Box>
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingSm">
                        Statistics
                      </Text>
                      <Box padding="200">
                        <BlockStack gap="200">
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text variant="bodySm">Total Products:</Text>
                            <Text variant="bodySm">0</Text>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text variant="bodySm">Products Updated:</Text>
                            <Text variant="bodySm">0</Text>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text variant="bodySm">Last Update:</Text>
                            <Text variant="bodySm">Never</Text>
                          </div>
                        </BlockStack>
                      </Box>
                    </BlockStack>
                  </Card>
                </BlockStack>
              </Layout.Section>
            </Layout>
          </BlockStack>
        </Page>
      </div>
    </Frame>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <Box
      as="span"
      padding="025"
      paddingInlineStart="100"
      paddingInlineEnd="100"
      background="bg-surface-active"
      borderWidth="025"
      borderColor="border"
      borderRadius="100"
    >
      <code>{children}</code>
    </Box>
  );
}
