import { useState } from 'react';
import {
  Icon,
  Text,
  Tooltip,
  Badge,
  Button,
  Box,
  BlockStack
} from "@shopify/polaris";
import {
  HomeIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  TextAlignCenterIcon,
  CashDollarIcon
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
  onClick: () => void;
  badge?: string;
}

interface SidebarProps {
  onExpandedChange?: (expanded: boolean) => void;
}

const sidebarSections: SidebarSection[] = [
  {
    id: 'home',
    title: '',
    items: [
      {
        id: 'home',
        icon: HomeIcon,
        label: 'Home',
        onClick: () => console.log('Home clicked')
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
        onClick: () => console.log('Edit Title clicked')
      },
      {
        id: 'price',
        icon: CashDollarIcon,
        label: 'Edit Price',
        onClick: () => console.log('Edit Price clicked')
      }
    ]
  }
];

export function Sidebar({ onExpandedChange }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const toggleSidebar = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandedChange?.(newExpanded);
    if (!newExpanded) {
      setActiveSection(null);
    }
  };

  const handleMouseEnter = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      onExpandedChange?.(true);
    }
  };

  const handleMouseLeave = () => {
    if (isExpanded) {
      setIsExpanded(false);
      onExpandedChange?.(false);
      setActiveSection(null);
    }
  };

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
                    onClick={item.onClick}
                    style={{
                      padding: '8px 16px',
                      margin: '0 8px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      backgroundColor: activeSection === item.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      transition: 'background-color 0.2s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={() => setActiveSection(item.id)}
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
                        <>
                          <span style={{ 
                            color: 'white',
                            marginLeft: '8px'
                          }}>
                            <Text variant="bodyMd" as="span">
                              {item.label}
                            </Text>
                          </span>
                          {item.badge && (
                            <Badge tone="info">
                              {item.badge}
                            </Badge>
                          )}
                        </>
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