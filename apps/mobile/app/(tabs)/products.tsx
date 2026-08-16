import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import type { Product } from "@skincause/contracts";
import { products as seededProducts } from "@skincause/domain";
import { errorMessage, useMobile } from "../../src/mobile-provider";
import { Notice, PrimaryButton, styles } from "../../src/ui";

export default function ProductsScreen() {
  const { createProduct, listProducts, updateProduct } = useMobile();
  const [products, setProducts] = useState<Product[]>(seededProducts);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("Acne care");
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listProducts()
        .then((loaded) => {
          if (active && loaded.length > 0) setProducts(loaded);
        })
        .catch((loadError: unknown) => {
          if (active) setError(errorMessage(loadError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [listProducts])
  );

  async function toggleProduct(product: Product) {
    setBusyId(product.id);
    setError("");
    try {
      const updated = await updateProduct(product.id, { active: !product.active });
      setProducts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (updateError) {
      setError(errorMessage(updateError));
    } finally {
      setBusyId(null);
    }
  }

  async function addProduct() {
    if (!name.trim()) {
      setError("Enter a product name.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const created = await createProduct({
        name: name.trim(),
        brand: brand.trim(),
        category: category.trim() || "Acne care",
        startedAt: new Date().toISOString(),
        cadence: "daily",
        timeOfDay: "PM",
        active: true,
        recentlyChanged: true
      });
      setProducts((current) => [...current, created]);
      setName("");
      setBrand("");
      setCategory("Acne care");
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setAdding(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Routine products</Text>
        <Text style={styles.heroTitle}>Keep the routine visible.</Text>
        <Text style={styles.heroBody}>
          Pause or restart one product while preserving the rest of the acne experiment.
        </Text>
      </View>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Notice danger>{error}</Notice> : null}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add a product</Text>
        <Text style={styles.body}>
          Add an affordable candidate or an existing routine step, then keep only one change active.
        </Text>
        <Text style={styles.smallLabel}>Product name</Text>
        <TextInput
          accessibilityLabel="Product name"
          value={name}
          onChangeText={setName}
          placeholder="Daily facial moisturizer"
          placeholderTextColor="#667777"
          style={styles.textInput}
        />
        <Text style={styles.smallLabel}>Brand</Text>
        <TextInput
          accessibilityLabel="Product brand"
          value={brand}
          onChangeText={setBrand}
          placeholder="Optional"
          placeholderTextColor="#667777"
          style={styles.textInput}
        />
        <Text style={styles.smallLabel}>Category</Text>
        <TextInput
          accessibilityLabel="Product category"
          value={category}
          onChangeText={setCategory}
          placeholder="Acne care"
          placeholderTextColor="#667777"
          style={styles.textInput}
        />
        <PrimaryButton
          label={adding ? "Adding product…" : "Add to routine"}
          disabled={adding}
          onPress={() => void addProduct()}
        />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current routine</Text>
        {products.map((product) => (
          <View style={styles.card} key={product.id}>
            <View style={styles.concernHeading}>
              <View style={styles.productInfo}>
                <Text style={styles.cardTitle}>
                  {product.brand ? `${product.brand} ` : ""}
                  {product.name}
                </Text>
                <Text style={styles.body}>
                  {product.category} · {product.timeOfDay} · {product.cadence}
                </Text>
              </View>
              <Text style={product.active ? styles.statusActive : styles.statusPaused}>
                {product.active ? "Active" : "Paused"}
              </Text>
            </View>
            <PrimaryButton
              label={
                busyId === product.id
                  ? "Saving…"
                  : product.active
                    ? "Pause product"
                    : "Restart product"
              }
              tone="paper"
              disabled={busyId !== null}
              onPress={() => void toggleProduct(product)}
            />
          </View>
        ))}
      </View>
      <Notice>
        Change only the product selected by the experiment. Other routine changes can make the
        comparison harder to interpret.
      </Notice>
    </ScrollView>
  );
}
