import React, { useState, useEffect, useMemo } from "react";
import {
  Text,
  BlockStack,
  InlineStack,
  Icon,
  Button,
  Spinner,
  Badge,
  TextField
} from "@shopify/polaris";
import { ChevronDownIcon, ChevronRightIcon, SearchIcon } from '@shopify/polaris-icons';

// Interface pour les nœuds de taxonomie
export interface TaxonomyNode {
  id: string;
  name: string;
  fullPath: string;
  children: TaxonomyNode[];
  level: number;
}

// Exemple de données de taxonomie d'animaux pour les tests
export const generateAnimalTaxonomy = (): TaxonomyNode[] => {
  return [
    {
      id: "animals",
      name: "Animals",
      fullPath: "Animals",
      level: 0,
      children: [
        {
          id: "mammals",
          name: "Mammals",
          fullPath: "Animals > Mammals",
          level: 1,
          children: [
            {
              id: "dogs",
              name: "Dogs",
              fullPath: "Animals > Mammals > Dogs",
              level: 2,
              children: [
                {
                  id: "labrador",
                  name: "Labrador",
                  fullPath: "Animals > Mammals > Dogs > Labrador",
                  level: 3,
                  children: []
                },
                {
                  id: "poodle",
                  name: "Poodle",
                  fullPath: "Animals > Mammals > Dogs > Poodle",
                  level: 3,
                  children: []
                }
              ]
            },
            {
              id: "cats",
              name: "Cats",
              fullPath: "Animals > Mammals > Cats",
              level: 2,
              children: [
                {
                  id: "siamese",
                  name: "Siamese",
                  fullPath: "Animals > Mammals > Cats > Siamese",
                  level: 3,
                  children: []
                },
                {
                  id: "persian",
                  name: "Persian",
                  fullPath: "Animals > Mammals > Cats > Persian",
                  level: 3,
                  children: []
                }
              ]
            }
          ]
        },
        {
          id: "birds",
          name: "Birds",
          fullPath: "Animals > Birds",
          level: 1,
          children: [
            {
              id: "parrots",
              name: "Parrots",
              fullPath: "Animals > Birds > Parrots",
              level: 2,
              children: []
            },
            {
              id: "eagles",
              name: "Eagles",
              fullPath: "Animals > Birds > Eagles",
              level: 2,
              children: []
            }
          ]
        },
        {
          id: "reptiles",
          name: "Reptiles",
          fullPath: "Animals > Reptiles",
          level: 1,
          children: [
            {
              id: "snakes",
              name: "Snakes",
              fullPath: "Animals > Reptiles > Snakes",
              level: 2,
              children: []
            },
            {
              id: "lizards",
              name: "Lizards",
              fullPath: "Animals > Reptiles > Lizards",
              level: 2,
              children: []
            }
          ]
        }
      ]
    }
  ];
};

interface CategoryTreeViewProps {
  categories: TaxonomyNode[];
  selectedCategoryId?: string;
  onSelectCategory: (categoryId: string, fullPath: string) => void;
  isLoading?: boolean;
}

interface NodeViewProps {
  node: TaxonomyNode;
  selectedCategoryId?: string;
  onSelectCategory: (id: string, fullPath: string) => void;
  depth: number;
}

// Composant enfant pour afficher un nœud et ses enfants
const NodeView: React.FC<NodeViewProps> = ({ node, selectedCategoryId, onSelectCategory, depth }) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedCategoryId === node.id;
  
  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };
  
  const handleSelect = () => {
    onSelectCategory(node.id, node.fullPath);
  };
  
  // Indentation pour les niveaux de profondeur
  const paddingLeft = `${depth * 20}px`;
  
  return (
    <div>
      <div 
        style={{ 
          padding: '8px 0', 
          paddingLeft, 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center',
          backgroundColor: isSelected ? 'rgba(0, 128, 96, 0.1)' : 'transparent',
          borderRadius: '4px',
          marginBottom: '2px'
        }}
        onClick={handleSelect}
      >
        {hasChildren && (
          <div style={{ marginRight: '4px', cursor: 'pointer' }} onClick={toggleExpanded}>
            <Icon source={expanded ? ChevronDownIcon : ChevronRightIcon} />
          </div>
        )}
        {!hasChildren && <div style={{ width: '20px' }}></div>}
        <Text 
          as="span" 
          variant="bodyMd" 
          fontWeight={isSelected ? 'bold' : 'regular'}
          tone={isSelected ? 'success' : 'subdued'}
        >
          {node.name}
        </Text>
        
        {hasChildren && (
          <Badge tone="info" size="small">
            {String(node.children.length)}
          </Badge>
        )}
      </div>
      
      {expanded && hasChildren && (
        <div style={{ marginLeft: '12px', borderLeft: '1px solid #e1e3e5', paddingLeft: '8px' }}>
          {node.children.map((child) => (
            <NodeView 
              key={child.id} 
              node={child} 
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={onSelectCategory} 
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const CategoryTreeView = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  isLoading = false
}: CategoryTreeViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [currentView, setCurrentView] = useState<'top' | 'subcategory'>('top');
  const [currentParent, setCurrentParent] = useState<TaxonomyNode | null>(null);
  
  // Ouvrir automatiquement les nœuds de premier niveau au chargement (les 26 catégories principales)
  useEffect(() => {
    // Puisqu'il y a 26 catégories principales, c'est raisonnable de les ouvrir toutes
    const rootNodeIds = categories.map(node => node.id);
    setExpandedNodes(new Set(rootNodeIds));
  }, [categories]);
  
  // Filtrer les catégories en fonction du terme de recherche (optimisé avec useMemo)
  const filteredCategories = useMemo(() => {
    const filterNodes = (nodes: TaxonomyNode[], term: string): TaxonomyNode[] => {
      if (!term) return nodes;
      
      const lowercaseTerm = term.toLowerCase();
      
      return nodes.filter(node => {
        const matchesName = node.name.toLowerCase().includes(lowercaseTerm);
        const matchesPath = node.fullPath.toLowerCase().includes(lowercaseTerm);
        const hasMatchingChildren = node.children.length > 0 && filterNodes(node.children, term).length > 0;
        
        return matchesName || matchesPath || hasMatchingChildren;
      }).map(node => ({
        ...node,
        children: filterNodes(node.children, term)
      }));
    };
    
    if (currentView === 'subcategory' && currentParent) {
      return filterNodes(currentParent.children, searchTerm);
    }
    
    return filterNodes(categories, searchTerm);
  }, [categories, searchTerm, currentView, currentParent]);
  
  // Navigation vers une sous-catégorie
  const navigateToSubcategory = (node: TaxonomyNode) => {
    if (node.children && node.children.length > 0) {
      setCurrentParent(node);
      setCurrentView('subcategory');
      setSearchTerm('');
    }
  };
  
  // Retour au niveau supérieur
  const backToTopLevel = () => {
    setCurrentView('top');
    setCurrentParent(null);
    setSearchTerm('');
  };
  
  // Rendu récursif des nœuds
  const renderCategoryNode = (node: TaxonomyNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedCategoryId === node.id;
    const isExpanded = expandedNodes.has(node.id);
    const isRootCategory = depth === 0; // Catégorie principale (niveau 0)
    
    const toggleNode = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newExpandedNodes = new Set(expandedNodes);
      if (isExpanded) {
        newExpandedNodes.delete(node.id);
      } else {
        newExpandedNodes.add(node.id);
      }
      setExpandedNodes(newExpandedNodes);
    };
    
    const selectThisCategory = () => {
      onSelectCategory(node.id, node.fullPath);
    };
    
    const handleClick = () => {
      if (currentView === 'top' && hasChildren && isRootCategory) {
        navigateToSubcategory(node);
      } else {
        selectThisCategory();
      }
    };
    
    return (
      <div key={node.id}>
        <div 
          onClick={handleClick}
          style={{ 
            padding: isRootCategory ? '12px 8px' : '8px 4px',
            cursor: 'pointer',
            backgroundColor: isSelected 
              ? 'var(--p-color-bg-surface-selected)' 
              : isRootCategory ? 'rgba(0, 128, 96, 0.05)' : 'transparent',
            borderRadius: '4px',
            marginBottom: isRootCategory ? '4px' : '2px',
            transition: 'background-color 0.2s ease',
            borderBottom: isRootCategory ? '1px solid rgba(0, 128, 96, 0.2)' : 'none'
          }}
        >
          <InlineStack blockAlign="center" gap="200">
            {hasChildren ? (
              <Button 
                onClick={() => {
                  const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
                  toggleNode(fakeEvent);
                }}
                icon={isExpanded ? ChevronDownIcon : ChevronRightIcon}
                variant="plain"
                accessibilityLabel={isExpanded ? "Réduire" : "Développer"}
              />
            ) : (
              <div style={{ width: '32px' }} /> 
            )}
            
            <Text 
              variant={isRootCategory ? "headingSm" : "bodyMd"} 
              as="span"
              fontWeight={isSelected ? "bold" : isRootCategory ? "semibold" : "regular"}
            >
              {node.name}
            </Text>
            
            {hasChildren && isRootCategory && currentView === 'top' && (
              <>
                <div style={{ flexGrow: 1 }}></div>
                <Icon source={ChevronRightIcon} />
              </>
            )}
            
            {hasChildren && !isRootCategory && (
              <Badge tone={isRootCategory ? "success" : "info"}>
                {String(node.children.length)}
              </Badge>
            )}
          </InlineStack>
        </div>
        
        {hasChildren && isExpanded && (
          <div style={{ 
            paddingLeft: '24px', 
            borderLeft: isRootCategory 
              ? '2px solid rgba(0, 128, 96, 0.3)' 
              : '1px solid var(--p-color-border-subdued)', 
            marginLeft: '16px'
          }}>
            <BlockStack gap="300">
              {node.children.map(childNode => renderCategoryNode(childNode, depth + 1))}
            </BlockStack>
          </div>
        )}
      </div>
    );
  };

  // Ajouter des logs pour déboguer l'arbre des catégories
  useEffect(() => {
    console.log('[CategoryTreeView] Categories loaded:', categories.length);
    if (categories.length > 0) {
      console.log('[CategoryTreeView] First level categories:', categories.map(c => c.name).join(', '));
      if (categories[0]?.children?.length > 0) {
        console.log('[CategoryTreeView] Children of first category:', categories[0].children.map(c => c.name).join(', '));
      }
    }
  }, [categories]);

  if (isLoading) {
    return (
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <BlockStack gap="400">
      <TextField
        label=""
        value={searchTerm}
        onChange={setSearchTerm}
        autoComplete="off"
        placeholder="Filtrer les catégories..."
        prefix={<Icon source={SearchIcon} />}
        clearButton
        onClearButtonClick={() => setSearchTerm('')}
      />
      
      <div style={{
        maxHeight: '500px', 
        overflowY: 'auto', 
        border: '1px solid var(--p-color-border-subdued)', 
        borderRadius: '4px', 
        padding: '12px',
        backgroundColor: 'var(--p-color-bg-surface)'
      }}>
        {currentView === 'subcategory' && (
          <div 
            onClick={() => backToTopLevel()}
            style={{ 
              padding: '12px 8px', 
              marginBottom: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Icon source={ChevronDownIcon} />
            <Text variant="headingMd" as="h2">
              &lt; Back to Top Level
            </Text>
          </div>
        )}
        
        {filteredCategories.length > 0 ? (
          <BlockStack gap="300">
            {currentView === 'top' && (
              <div style={{ marginBottom: '8px' }}>
                <Text variant="bodySm" as="p" tone="success" fontWeight="medium">
                  Les 26 catégories principales sont affichées ci-dessous:
                </Text>
              </div>
            )}
            
            {currentView === 'subcategory' && currentParent && (
              <div style={{ marginBottom: '8px' }}>
                <Text variant="headingMd" as="h2">{currentParent.name}</Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  {currentParent.children.length} sous-catégories
                </Text>
              </div>
            )}
            
            {currentView === 'subcategory' && currentParent 
              ? currentParent.children.map(node => (
                  <div 
                    key={node.id}
                    onClick={() => onSelectCategory(node.id, node.fullPath)}
                    style={{ 
                      padding: '12px 8px',
                      cursor: 'pointer',
                      backgroundColor: selectedCategoryId === node.id
                        ? 'var(--p-color-bg-surface-selected)' 
                        : 'transparent',
                      borderRadius: '4px',
                      marginBottom: '4px',
                      borderBottom: '1px solid rgba(0, 128, 96, 0.1)'
                    }}
                  >
                    <Text 
                      variant="bodyMd" 
                      as="span"
                      fontWeight={selectedCategoryId === node.id ? "bold" : "regular"}
                    >
                      {node.name}
                    </Text>
                  </div>
                ))
              : filteredCategories.map(node => renderCategoryNode(node))
            }
          </BlockStack>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <Text variant="bodyMd" as="p" tone="subdued">
              Aucune catégorie ne correspond à votre recherche
            </Text>
          </div>
        )}
      </div>
      
      <Text variant="bodySm" as="p" tone="subdued">
        {categories.length} catégories principales regroupant plus de 10 500 sous-catégories dans la taxonomie officielle Shopify.
      </Text>
    </BlockStack>
  );
};

export default CategoryTreeView;

// Composant de démonstration avec la taxonomie d'animaux prédéfinie
export const AnimalCategoryTreeDemo: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedPath, setSelectedPath] = useState<string>("");
  const animalTaxonomy = useMemo(() => generateAnimalTaxonomy(), []);
  
  const handleSelectCategory = (categoryId: string, fullPath: string) => {
    setSelectedCategory(categoryId);
    setSelectedPath(fullPath);
    console.log(`Catégorie sélectionnée: ${categoryId}, Chemin: ${fullPath}`);
  };
  
  return (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h1">Démo de taxonomie d'animaux</Text>
      
      {selectedCategory && (
        <BlockStack gap="200">
          <Text variant="bodyMd" as="p" fontWeight="bold">
            Catégorie sélectionnée: 
          </Text>
          <Text variant="bodyLg" as="p">
            {selectedPath}
          </Text>
        </BlockStack>
      )}
      
      <CategoryTreeView 
        categories={animalTaxonomy} 
        selectedCategoryId={selectedCategory}
        onSelectCategory={handleSelectCategory}
      />
    </BlockStack>
  );
}; 