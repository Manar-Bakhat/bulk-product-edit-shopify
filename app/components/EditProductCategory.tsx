/**
 * EditProductCategory Component
 * This component handles bulk editing of product categories.
 * It provides functionality to:
 * 1. Filter products based on various criteria
 * 2. Preview filtered products
 * 3. Edit product categories in bulk
 * 
 * @author Manar Bakhat
 */

import React, { useState, useEffect } from "react";
import {
  Text,
  BlockStack,
  Card,
  InlineStack,
  Icon,
  Button,
  Select,
  TextField,
  DataTable,
  Banner,
  Spinner,
  Badge,
  ProgressBar,
  Pagination,
  Divider,
  Autocomplete,
  LegacyStack as Stack,
  Tag
} from "@shopify/polaris";
import { FilterIcon, ResetIcon, EditIcon, SearchIcon } from '@shopify/polaris-icons';
import { useSubmit, useActionData, useLoaderData } from "@remix-run/react";
import Swal from 'sweetalert2';
import { getShopifyTaxonomyCategories, getBasicCategories, getTaxonomyTree } from "../services/taxonomyService";
import CategoryTreeView, { TaxonomyNode } from "./CategoryTreeView";

interface Product {
  id: string;
  title: string;
  description: string;
  handle: string;
  productType: string;
  status: string;
  tags: string[];
  vendor: string;
  featuredImage: {
    url: string;
    altText: string;
  } | null;
  priceRangeV2: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  collections: {
    edges: Array<{
      node: {
        id: string;
        title: string;
      };
    }>;
  };
  productCategory?: {
    productTaxonomyNode?: {
      name: string;
    };
  };
}

interface ActionData {
  data?: {
    products: {
      edges: Array<{
        node: Product;
      }>;
    };
  };
  error?: string;
  success?: boolean;
  message?: string;
}

// Ajouter une interface pour les catégories hiérarchiques
interface TaxonomyCategory {
  id: string;
  name: string;
  level: number;
  parentId?: string;
}

const EditProductCategory = () => {
  const [selectedField, setSelectedField] = useState('title');
  const [selectedCondition, setSelectedCondition] = useState('contains');
  const [filterValue, setFilterValue] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const submit = useSubmit();
  const actionData = useActionData<ActionData>();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;
  const [newProductCategory, setNewProductCategory] = useState('');
  const [taxonomyOptions, setTaxonomyOptions] = useState<{ label: string; value: string }[]>([]);
  const [hierarchicalCategories, setHierarchicalCategories] = useState<TaxonomyCategory[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [hierarchyTree, setHierarchyTree] = useState<TaxonomyNode[]>([]);
  const [isTreeView, setIsTreeView] = useState(true);

  // Fonction pour organiser les catégories de manière hiérarchique
  const organizeHierarchicalCategories = (categories: { label: string; value: string }[]) => {
    const result: TaxonomyCategory[] = [];
    
    categories.forEach((category) => {
      const { label, value } = category;
      const parts = label.split(' > ');
      let currentLevel = 0;
      let parentId: string | undefined = undefined;
      
      // Traiter chaque niveau de la hiérarchie
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // C'est la catégorie actuelle
          result.push({
            id: value,
            name: part.trim(),
            level: currentLevel,
            parentId
          });
        } else {
          // C'est un parent dans la hiérarchie
          const parentCategory = {
            id: `${value}_parent_${index}`,
            name: part.trim(),
            level: currentLevel,
            parentId
          };
          
          // Éviter les doublons
          if (!result.some(cat => cat.name === parentCategory.name && cat.level === currentLevel)) {
            result.push(parentCategory);
          }
          
          // Le parent pour le prochain niveau
          parentId = parentCategory.id;
          currentLevel++;
        }
      });
    });
    
    return result;
  };

  // Fonction utilitaire pour convertir TaxonomyNode[] en options pour l'autocomplete
  const convertTreeToOptions = (nodes: TaxonomyNode[]): { label: string; value: string }[] => {
    const result: { label: string; value: string }[] = [];
    
    const processNode = (node: TaxonomyNode) => {
      result.push({
        label: node.fullPath,
        value: node.id
      });
      
      node.children.forEach(child => processNode(child));
    };
    
    nodes.forEach(node => processNode(node));
    return result;
  };

  // Charge les catégories Shopify lors du chargement du composant
  useEffect(() => {
    async function loadCategories() {
      try {
        setIsLoadingCategories(true);
        
        // Essayer de charger l'arbre taxonomique
        const tree = await getTaxonomyTree();
        setHierarchyTree(tree);
        
        // Charger également la liste plate pour l'autocomplete
        const categories = await getShopifyTaxonomyCategories();
        
        if (categories.length > 0) {
          setTaxonomyOptions(categories);
          setHierarchicalCategories(organizeHierarchicalCategories(categories));
        } else {
          // Fallback sur les catégories de base
          const basicCategories = getBasicCategories();
          // Convertir l'arbre en options pour l'autocomplete
          const formattedBasicCategories = convertTreeToOptions(basicCategories);
          setTaxonomyOptions(formattedBasicCategories);
          setHierarchicalCategories(organizeHierarchicalCategories(formattedBasicCategories));
        }
      } catch (error) {
        console.error('[EditProductCategory] Erreur lors du chargement des catégories:', error);
        // En cas d'erreur, utiliser les catégories de base
        const basicCategories = getBasicCategories();
        // Convertir l'arbre en options pour l'autocomplete
        const formattedBasicCategories = convertTreeToOptions(basicCategories);
        setTaxonomyOptions(formattedBasicCategories);
        setHierarchicalCategories(organizeHierarchicalCategories(formattedBasicCategories));
      } finally {
        setIsLoadingCategories(false);
      }
    }
    
    loadCategories();
  }, []);

  // Transformer les catégories en options pour Autocomplete
  const getAutocompleteOptions = () => {
    const deduplicatedOptions = taxonomyOptions.reduce((acc, current) => {
      // Prendre seulement la première partie pour créer les groupes de premier niveau
      const topLevel = current.label.split(' > ')[0];
      const existingGroup = acc.find(group => group.title === topLevel);
      
      if (existingGroup) {
        existingGroup.options.push({
          value: current.value,
          label: current.label
        });
      } else {
        acc.push({
          title: topLevel,
          options: [{
            value: current.value,
            label: current.label
          }]
        });
      }
      
      return acc;
    }, [] as { title: string; options: { value: string; label: string }[] }[]);
    
    return deduplicatedOptions;
  };

  // Filtrer les options basé sur la recherche
  const filterOptions = (query: string) => {
    if (!query) {
      return getAutocompleteOptions().slice(0, 10); // Limiter à 10 catégories principales
    }
    
    const normalizedQuery = query.toLowerCase();
    
    const filteredGroups = getAutocompleteOptions().map(group => {
      const filteredOptions = group.options.filter(option =>
        option.label.toLowerCase().includes(normalizedQuery)
      );
      
      return {
        ...group,
        options: filteredOptions
      };
    }).filter(group => group.options.length > 0);
    
    return filteredGroups;
  };

  // Gérer la sélection de catégorie
  const handleCategorySelect = (selected: string[]) => {
    if (selected.length === 0) {
      setSelectedCategory(undefined);
      setSelectedOptions([]);
      return;
    }
    
    const categoryId = selected[0];
    setSelectedCategory(categoryId);
    setSelectedOptions(selected);
    setNewProductCategory(categoryId);
    
    // Mettre à jour la valeur d'entrée avec le label complet
    const selectedOption = taxonomyOptions.find(option => option.value === categoryId);
    if (selectedOption) {
      setInputValue(selectedOption.label);
    }
  };
  
  // Gérer la mise à jour de l'entrée de recherche
  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  // Construire les options de l'Autocomplete
  const autocompleteOptions = filterOptions(inputValue);
  
  // Convertir la sélection en tags pour l'affichage
  const selectedTags = selectedOptions.map(option => {
    const selectedOption = taxonomyOptions.find(opt => opt.value === option);
    return selectedOption ? selectedOption.label : '';
  });

  // Handle filtered products
  useEffect(() => {
    if (actionData) {
      if (actionData.data?.products?.edges) {
        const filteredProducts = actionData.data.products.edges.map(({ node }) => {
          return {
          id: node.id.replace('gid://shopify/Product/', ''),
          title: node.title,
          description: node.description,
            handle: node.handle || "",
          productType: node.productType,
          vendor: node.vendor,
          status: node.status,
            tags: node.tags || [],
          featuredImage: node.featuredImage,
          priceRangeV2: node.priceRangeV2,
            collections: node.collections,
            productCategory: node.productCategory
          } as Product;
        });
        setProducts(filteredProducts);
        setHasSearched(true);
      }
      setIsLoading(false);
    }
  }, [actionData]);

  // Handle action data response for success/error
  useEffect(() => {
    if (actionData) {
      console.log('[EditProductCategory] Received action data:', actionData);
      
      if (actionData.success) {
        console.log('[EditProductCategory] Bulk edit successful!');
        // Reset form fields
        setNewProductCategory('');

        // Show success message
        Swal.fire({
          title: 'Success!',
          text: actionData.message || 'Product category updated successfully!',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
      } else if (actionData.error) {
        console.error('[EditProductCategory] Bulk edit failed:', actionData.error);
        Swal.fire({
          title: 'Error',
          text: actionData.error,
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
      }
    }
  }, [actionData]);

  // Calculate pagination
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = products.slice(startIndex, endIndex);

  const rows = currentProducts.map((product) => [
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <img 
        src={product.featuredImage?.url || 'https://cdn.shopify.com/s/files/1/0757/9956/5321/files/placeholder.png'} 
        alt={product.featuredImage?.altText || 'Product image'} 
        style={{ 
          width: '60px', 
          height: '60px', 
          objectFit: 'cover',
          borderRadius: '4px'
        }}
        onError={(e) => {
          e.currentTarget.src = 'https://cdn.shopify.com/s/files/1/0757/9956/5321/files/placeholder.png';
        }}
      />
      <div>
        <Text variant="bodyMd" as="p" fontWeight="bold">{product.title}</Text>
        <Text variant="bodySm" as="p" tone="subdued">{product.vendor}</Text>
      </div>
    </div>,
    <div style={{ 
      maxWidth: '200px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      position: 'relative'
    }}>
      <Text variant="bodySm" as="p" tone="subdued">
        {product.description ? (
          <div style={{ 
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {product.description}
          </div>
        ) : 'No description'}
      </Text>
    </div>,
    <div>
      <Text variant="bodySm" as="p">{product.productType || 'N/A'}</Text>
    </div>,
    <div>
      {product.productCategory?.productTaxonomyNode?.name ? (
      <Text variant="bodySm" as="p">
          {product.productCategory.productTaxonomyNode.name}
      </Text>
      ) : product.collections?.edges?.length > 0 ? (
        <InlineStack gap="200">
          {product.collections.edges.map((edge, index) => (
            <Badge key={index} tone="info">
              {edge.node.title}
            </Badge>
          ))}
        </InlineStack>
      ) : (
        <Text variant="bodySm" as="p" tone="subdued">No category</Text>
      )}
    </div>,
    <div>
      <Badge tone={product.status === 'ACTIVE' ? 'success' : 'warning'}>
        {product.status}
      </Badge>
    </div>,
    <div style={{ textAlign: 'right' }}>
      <Text variant="bodyMd" as="p" fontWeight="bold">
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: product.priceRangeV2.minVariantPrice.currencyCode
        }).format(parseFloat(product.priceRangeV2.minVariantPrice.amount))}
      </Text>
    </div>
  ]);

  const fieldOptions = [
    { label: 'Title', value: 'title' },
    { label: 'Description', value: 'description' },
    { label: 'Product ID', value: 'productId' }
  ];

  // Base condition options for non-description fields
  const baseConditionOptions = [
    { label: 'is', value: 'is' },
    { label: 'contains', value: 'contains' },
    { label: 'does not contain', value: 'doesNotContain' },
    { label: 'starts with', value: 'startsWith' },
    { label: 'ends with', value: 'endsWith' },
  ];

  // Product ID condition options (only 'is')
  const productIdConditionOptions = [
    { label: 'is', value: 'is' }
  ];

  // Condition options for description field (without 'is')
  const descriptionConditionOptions = [
    { label: 'contains', value: 'contains' },
    { label: 'does not contain', value: 'doesNotContain' },
    { label: 'starts with', value: 'startsWith' },
    { label: 'ends with', value: 'endsWith' },
    { label: 'empty', value: 'empty' }
  ];

  // Handle field change
  const handleFieldChange = (value: string) => {
    setSelectedField(value);
    // If switching to description and current condition is 'is', change to 'contains'
    if (value === 'description' && selectedCondition === 'is') {
      setSelectedCondition('contains');
    }
    // If switching to productId, change condition to 'is'
    if (value === 'productId') {
      setSelectedCondition('is');
    }
  };

  const handlePreview = () => {
    setIsLoading(true);
    setHasSearched(true);
    const formData = new FormData();
    formData.append("field", selectedField);
    formData.append("condition", selectedCondition);
    formData.append("value", filterValue);
    submit(formData, { method: "post" });
  };

  const handleClearFilters = () => {
    setSelectedField('title');
    setSelectedCondition('contains');
    setFilterValue('');
    setHasSearched(false);
    setProducts([]);
  };

  const handleBulkEdit = () => {
    // Check if products have been filtered first
    if (!products.length) {
      // Show error if no products are filtered
      Swal.fire({
        title: 'Error',
        text: 'Please filter and preview products first before starting bulk edit.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: "#008060"
      });
      return;
    }

    if (!selectedCategory) {
      // Show an error if no product category is selected
      Swal.fire({
        title: 'Error',
        text: 'Please select a product taxonomy category.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: "#008060"
      });
      return;
    }

    // Here you would add the logic to submit the form
    console.log('Starting bulk edit for product category:', {
      selectedCategory,
      products: products.map(p => p.id)
    });

    // Submit form logic
    const formData = new FormData();
    formData.append("actionType", "bulkEdit");
    formData.append("section", "productCategory");
    formData.append("productIds", JSON.stringify(products.map(p => p.id)));
    formData.append("newProductCategory", selectedCategory);
    
    submit(formData, { method: "post" });
  };

  // Gérer la sélection depuis l'arborescence
  const handleTreeCategorySelect = (categoryId: string, fullPath: string) => {
    setSelectedCategory(categoryId);
    setNewProductCategory(categoryId);
    setInputValue(fullPath);
    
    // Mettre également à jour les options sélectionnées pour l'autocomplete
    setSelectedOptions([categoryId]);
  };

  return (
    <BlockStack gap="500">
      {/* Progress Indicator */}
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Badge tone="success">Step 1 of 2</Badge>
          <ProgressBar progress={50} tone="success" />
        </InlineStack>
      </BlockStack>
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Icon source={FilterIcon} tone="success" />
              <Text variant="headingSm" as="h2">Filter Products</Text>
            </InlineStack>
            <Button
              icon={ResetIcon}
              onClick={handleClearFilters}
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
                options={fieldOptions}
                value={selectedField}
                onChange={handleFieldChange}
              />
              <Select
                label=""
                options={
                  selectedField === 'description' 
                    ? descriptionConditionOptions 
                    : selectedField === 'productId'
                      ? productIdConditionOptions
                      : baseConditionOptions
                }
                value={selectedCondition}
                onChange={setSelectedCondition}
              />
              {selectedCondition !== 'empty' && (
                <div style={{ minWidth: '200px' }}>
                  <TextField
                    label=""
                    value={filterValue}
                    onChange={setFilterValue}
                    autoComplete="off"
                    placeholder="Enter search text..."
                  />
                </div>
              )}
            </InlineStack>

            <InlineStack gap="300">
              <Button variant="primary" onClick={handlePreview} loading={isLoading} tone="success">
                Preview matching products
              </Button>
            </InlineStack>

            {/* Display Product Table */}
            {hasSearched && (
              <BlockStack gap="400">
                {isLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <Spinner size="large" />
                  </div>
                ) : products.length === 0 ? (
                  <Banner title="No products found" tone="warning">
                    <p>No products match your filter criteria. Try adjusting your filters.</p>
                  </Banner>
                ) : (
                  <BlockStack gap="300">
                    <Text variant="bodySm" as="p" fontWeight="semibold">
                      {products.length} {products.length === 1 ? 'product' : 'products'} found
                    </Text>
                    <DataTable
                      columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                      headings={['Product', 'Description', 'Type', 'Categories', 'Status', 'Price']}
                      rows={rows}
                    />
                    <Text variant="bodySm" as="p" tone="subdued">
                      Note: Using official Shopify Product Taxonomy with over 10,500 standardized categories. Products can belong to both a Product Taxonomy category and multiple Collections.
                    </Text>
                    {products.length > itemsPerPage && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                        <Pagination
                          label={`${currentPage} of ${totalPages}`}
                          hasPrevious={currentPage > 1}
                          onPrevious={() => setCurrentPage(currentPage - 1)}
                          hasNext={currentPage < totalPages}
                          onNext={() => setCurrentPage(currentPage + 1)}
                        />
                      </div>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
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

      {/* Edit Product Category Section */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Icon source={EditIcon} tone="success" />
              <Text variant="headingSm" as="h2">Edit Product Category</Text>
            </InlineStack>
            <Button
              onClick={() => setIsTreeView(!isTreeView)}
              variant="plain"
            >
              {isTreeView ? 'Search View' : 'Tree View'}
            </Button>
          </InlineStack>
          <Divider />

          <BlockStack gap="400">
            <div style={{ maxWidth: '650px' }}>
              {isLoadingCategories ? (
                <InlineStack align="center" blockAlign="center" gap="200">
                  <Spinner size="small" />
                  <Text as="p">Loading official Shopify Product Taxonomy categories...</Text>
                </InlineStack>
              ) : isTreeView ? (
                <BlockStack gap="200">
                  <Text as="p" variant="headingMd">
                    Select a category from the tree
                  </Text>
                  <InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Parcourez les 26 catégories principales de Shopify (comme Vêtements, Électronique, etc.) et leurs 
                      sous-catégories (plus de 10 500 au total). Cliquez sur les flèches ▼ pour développer chaque niveau 
                      de l'arborescence.
                    </Text>
                  </InlineStack>
                  <div style={{ marginTop: '12px' }}>
                    <CategoryTreeView 
                      categories={hierarchyTree}
                      selectedCategoryId={selectedCategory}
                      onSelectCategory={handleTreeCategorySelect}
                    />
                  </div>
                </BlockStack>
              ) : (
                <BlockStack gap="200">
                  <Text as="p" variant="headingMd">
                    Search for a category
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Recherchez une catégorie spécifique parmi les 26 catégories principales et leurs plus de 10 500 sous-catégories 
                    dans la taxonomie officielle de Shopify.
                  </Text>
                  <Autocomplete
                    allowMultiple={false}
                    options={autocompleteOptions}
                    selected={selectedOptions}
                    textField={
                      <Autocomplete.TextField
                        onChange={handleInputChange}
                        label="Select a Shopify taxonomy category"
                        value={inputValue}
                        prefix={<Icon source={SearchIcon} />}
                        placeholder="Search for a category..."
                        autoComplete="off"
                      />
                    }
                    onSelect={handleCategorySelect}
                  />
                  
                  {selectedOptions.length > 0 && (
                    <InlineStack gap="200" wrap={true}>
                      {selectedTags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </InlineStack>
                  )}
                  
                  <Text as="p" variant="bodySm" tone="subdued">
                    Each category represents an official Shopify product category that customers can use to find your products.
                  </Text>
                </BlockStack>
              )}
            </div>
            
            <InlineStack gap="400" blockAlign="center">
              <Button 
                variant="primary" 
                onClick={handleBulkEdit} 
                tone="success"
                disabled={!selectedCategory || isLoadingCategories}
              >
                Start bulk edit now
              </Button>
              
              {selectedCategory && (
                <Text variant="bodySm" as="p">
                  Selected category: <strong>{taxonomyOptions.find(opt => opt.value === selectedCategory)?.label || selectedCategory}</strong>
                </Text>
              )}
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

export default EditProductCategory; 