/**
 * @author Manar Bakhat
 */
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";

export async function handleDescriptionEdit(request: Request, formData: FormData) {
  console.log('[DescriptionEditService] Starting description edit process');
  const { admin } = await authenticate.admin(request);
  const productIds = JSON.parse(formData.get("productIds") as string);
  const productDescriptions = JSON.parse(formData.get("productDescriptions") as string);
  const textToAdd = formData.get("textToAdd") as string;
  const textToRemove = formData.get("textToRemove") as string;
  const position = formData.get("position") as string;
  const editType = formData.get("editType") as string;

  console.log('[DescriptionEditService] Input data:', {
    productIds,
    textToAdd,
    textToRemove,
    position,
    editType
  });

  try {
    // Update each product's description
    for (const productId of productIds) {
      console.log(`[DescriptionEditService] Processing product ${productId}`);
      await updateProductDescription(admin, productId, productDescriptions[productId], textToAdd, textToRemove, position, editType);
    }

    console.log('[DescriptionEditService] All products updated successfully');
    return json({ success: true });
  } catch (error) {
    console.error('[DescriptionEditService] Error updating descriptions:', error);
    return json({ error: 'Failed to update descriptions' });
  }
}

async function updateProductDescription(
  admin: any,
  productId: string,
  currentDescription: string,
  textToAdd: string,
  textToRemove: string,
  position: string,
  editType: string
) {
  console.log(`[DescriptionEditService] Updating description for product ${productId}`);
  
  // First, get the current product description HTML
  const getProductQuery = `#graphql
    query {
      product(id: "gid://shopify/Product/${productId}") {
        id
        descriptionHtml
      }
    }
  `;

  console.log('[DescriptionEditService] Fetching current product description...');
  const productResponse = await admin.graphql(getProductQuery);
  const productData = await productResponse.json();

  if (productData.errors) {
    console.error('[DescriptionEditService] GraphQL errors:', productData.errors);
    throw new Error(`GraphQL errors: ${JSON.stringify(productData.errors)}`);
  }

  const currentDescriptionHtml = productData.data?.product?.descriptionHtml || '';
  console.log('[DescriptionEditService] Current description HTML:', currentDescriptionHtml);

  let newDescriptionHtml = currentDescriptionHtml;

  if (editType === 'remove') {
    // Create a case-insensitive regex pattern for removal
    const regex = new RegExp(textToRemove, 'gi');
    // Remove the text from the HTML content
    newDescriptionHtml = currentDescriptionHtml.replace(regex, '').trim();
  } else {
    // Handle adding text based on position
    if (position === 'beginning') {
      newDescriptionHtml = `${textToAdd} ${currentDescriptionHtml}`;
    } else if (position === 'end') {
      newDescriptionHtml = `${currentDescriptionHtml} ${textToAdd}`;
    }
  }

  const mutation = `#graphql
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          descriptionHtml
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      id: `gid://shopify/Product/${productId}`,
      descriptionHtml: newDescriptionHtml
    }
  };

  console.log('[DescriptionEditService] Sending update mutation with variables:', variables);
  const updateResponse = await admin.graphql(mutation, {
    variables: variables
  });

  const updateData = await updateResponse.json();
  console.log('[DescriptionEditService] Update response:', updateData);

  if (updateData.errors) {
    console.error('[DescriptionEditService] Update mutation errors:', updateData.errors);
    throw new Error(`Update mutation errors: ${JSON.stringify(updateData.errors)}`);
  }

  const userErrors = updateData.data?.productUpdate?.userErrors;
  if (userErrors && userErrors.length > 0) {
    console.error('[DescriptionEditService] User errors:', userErrors);
    throw new Error(`User errors: ${JSON.stringify(userErrors)}`);
  }

  console.log(`[DescriptionEditService] Successfully updated description for product ${productId}`);
} 