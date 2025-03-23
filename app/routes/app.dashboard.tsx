/**
 * Dashboard Page Component
 * This component serves as the main dashboard for the application.
 * It provides:
 * 1. A sidebar for navigation between different sections
 * 2. A welcome message with store information
 * 3. Navigation to bulk editing features (title and price)
 * 
 * @author Manar Bakhat
 */

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

/**
 * LoaderData interface defining the structure of shop data
 * Used for type safety and data handling throughout the component
 */
interface LoaderData {
  shop: {
    name: string;
    email: string;
    myshopifyDomain: string;
  } | null;
}

/**
 * Loader function to fetch shop data
 * Retrieves the store's basic information from Shopify
 */
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

/**
 * Dashboard Component
 * Main component that displays the application's dashboard interface
 * Includes a collapsible sidebar and main content area
 */
export default function Dashboard() {
  // State management for sidebar and navigation
  const { shop } = useLoaderData<LoaderData>();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const navigate = useNavigate();

  /**
   * Handles sidebar expansion state changes
   * @param expanded - Boolean indicating if the sidebar is expanded
   */
  const handleSidebarChange = (expanded: boolean) => {
    setIsSidebarExpanded(expanded);
  };

  /**
   * Handles section changes in the sidebar
   * Navigates to the appropriate route when a section is selected
   * @param section - The selected section identifier
   */
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    if (section === "title" || section === "price") {
      navigate(`/app/bulkEdit?section=${section}`);
    }
  };

  /**
   * Renders the home content section
   * Displays a welcome message with store information
   */
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
      {/* Sidebar Component */}
      <Sidebar
        onExpandedChange={handleSidebarChange}
        onSectionChange={handleSectionChange}
        activeSection={activeSection}
      />
      
      {/* Main Content Area */}
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
