/**
 * Sidebar Component
 * This component provides navigation between different sections of the application.
 * It includes links to the dashboard and bulk editing features.
 * 
 * @author Manar Bakhat
 */

import { useState } from 'react';
import {
  Icon,
  Text,
  Tooltip,
  Box,
  BlockStack
} from "@shopify/polaris";
import {
  HomeIcon,
  TextAlignCenterIcon,
  CashDollarIcon,
  StoreIcon,
  EditIcon,
  FileIcon
} from '@shopify/polaris-icons';

interface SidebarSection {
  id: string;
  title: string;
  items: SidebarItem[];
}

interface SidebarItem {
  id: string;
  icon: React.FC;
  label: string;
  sectionId: string;
}

interface SidebarProps {
  onExpandedChange?: (expanded: boolean) => void;
  onSectionChange?: (section: string) => void;
  activeSection?: string;
}

export function Sidebar({ onExpandedChange, onSectionChange, activeSection }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleMouseEnter = () => {
    setIsExpanded(true);
    onExpandedChange?.(true);
  };

  const handleMouseLeave = () => {
    setIsExpanded(false);
    onExpandedChange?.(false);
  };

  const handleItemClick = (sectionId: string) => {
    onSectionChange?.(sectionId);
  };

  const sidebarSections: SidebarSection[] = [
    {
      id: 'home',
      title: '',
      items: [
        {
          id: 'home',
          icon: HomeIcon,
          label: 'Home',
          sectionId: 'home'
        }
      ]
    },
    {
      id: 'bulkEdit',
      title: 'Bulk Edit',
      items: [
        {
          id: 'title',
          icon: TextAlignCenterIcon,
          label: 'Edit Title',
          sectionId: 'title'
        },
        {
          id: 'price',
          icon: CashDollarIcon,
          label: 'Edit Price',
          sectionId: 'price'
        },
        {
          id: 'vendor',
          icon: StoreIcon,
          label: 'Edit Vendor',
          sectionId: 'vendor'
        },
        {
          id: 'description',
          icon: FileIcon,
          label: 'Edit Description',
          sectionId: 'description'
        }
      ]
    }
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isExpanded && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 99
          }}
          onClick={() => {
            setIsExpanded(false);
            onExpandedChange?.(false);
          }}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: isExpanded ? '240px' : '60px',
          backgroundColor: 'rgb(31, 33, 36)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 100,
          boxShadow: isExpanded ? 'var(--p-shadow-lg)' : 'var(--p-shadow-md)',
          overflow: 'hidden'
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Sections */}
        <BlockStack gap="400">
          {sidebarSections.map((section, index) => (
            <div key={section.id} style={{ 
              marginTop: index === 0 ? '20px' : '0'
            }}>
              {isExpanded && section.title && (
                <Box padding="300">
                  <Text variant="headingXs" as="h2" tone="subdued">
                    {section.title}
                  </Text>
                </Box>
              )}
              
              <BlockStack gap="200">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item.sectionId)}
                    style={{
                      padding: '8px 16px',
                      margin: '0 8px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      backgroundColor: activeSection === item.sectionId ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      transition: 'background-color 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <span style={{ 
                        color: 'white',
                        width: '20px',
                        display: 'flex',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Icon source={item.icon} />
                      </span>
                      
                      {isExpanded && (
                        <span style={{ 
                          color: 'white',
                          marginLeft: '8px'
                        }}>
                          <Text variant="bodyMd" as="span">
                            {item.label}
                          </Text>
                        </span>
                      )}
                      
                      {!isExpanded && (
                        <Tooltip content={item.label} dismissOnMouseOut>
                          <span style={{ display: 'none' }}>{item.label}</span>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                ))}
              </BlockStack>
            </div>
          ))}
        </BlockStack>
      </div>
    </>
  );
}
