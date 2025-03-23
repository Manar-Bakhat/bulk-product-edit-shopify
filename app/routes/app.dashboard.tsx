import { useState } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  Frame,
  BlockStack,
  Box
} from "@shopify/polaris";
import { Sidebar } from "../components/Sidebar";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";

interface LoaderData {
  shop: {
    name: string;
    email: string;
    myshopifyDomain: string;
  } | null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(
      `#graphql
      query {
        shop {
          name
          email
          myshopifyDomain
        }
      }`
    );

    const responseJson = await response.json();
    return json({
      shop: responseJson.data.shop
    });
  } catch (error) {
    console.error('Error loading shop data:', error);
    return json({
      shop: null
    });
  }
};

export default function Dashboard() {
  const { shop } = useLoaderData<LoaderData>();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const navigate = useNavigate();

  const handleSidebarChange = (expanded: boolean) => {
    setIsSidebarExpanded(expanded);
  };

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    if (section === "title" || section === "price") {
      navigate(`/app/bulkEdit?section=${section}`);
    }
  };

  const renderHomeContent = () => (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="400">
          <Box padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Welcome to {shop?.name || 'Your Store'}</Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Select an option from the sidebar to start editing your products.
              </Text>
            </BlockStack>
          </Box>
        </BlockStack>
      </Card>
    </BlockStack>
  );

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
              {renderHomeContent()}
            </Layout.Section>
          </Layout>
        </Page>
      </div>
    </Frame>
  );
}
