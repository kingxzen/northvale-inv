const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/context/app-context.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
const imports = `import { listProductsFromSupabase, saveProductToSupabase, saveProductBomLinesToSupabase } from "@/lib/supabase/repositories/products";
import { listProductionJobsFromSupabase, saveProductionJobToSupabase } from "@/lib/supabase/repositories/production";
import { listActivityLogsFromSupabase, listStockTransactionsFromSupabase, saveActivityLogToSupabase, saveStockTransactionToSupabase } from "@/lib/supabase/repositories/logs";
`;

if (!content.includes('listProductsFromSupabase')) {
  content = content.replace('import { createInventoryItemInSupabase, listInventoryItemsFromSupabase, updateInventoryItemInSupabase, importInventoryBackupToSupabase, restoreInventoryToSupabase } from "@/lib/supabase/repositories/inventory";', 
    'import { createInventoryItemInSupabase, listInventoryItemsFromSupabase, updateInventoryItemInSupabase, importInventoryBackupToSupabase, restoreInventoryToSupabase } from "@/lib/supabase/repositories/inventory";\n' + imports);
}

// 2. Hydration
const hydrateOld = `
    if (isSupabaseConfigured()) {
      try {
        const result = await listInventoryItemsFromSupabase();
        if (!active) return;
        setInventoryItems(result.items);
        setInventoryError(null);
        setLastInventorySync(new Date().toISOString());
      } catch (error) {
`;

const hydrateNew = `
    if (isSupabaseConfigured()) {
      try {
        const [invResult, prodResult, jobsResult, txnsResult, logsResult] = await Promise.all([
          listInventoryItemsFromSupabase().catch(e => { console.error(e); return { items: [] }; }),
          listProductsFromSupabase().catch(e => { console.error(e); return { products: [], bomLines: [] }; }),
          listProductionJobsFromSupabase().catch(e => { console.error(e); return []; }),
          listStockTransactionsFromSupabase().catch(e => { console.error(e); return []; }),
          listActivityLogsFromSupabase().catch(e => { console.error(e); return []; })
        ]);
        if (!active) return;
        
        if (invResult.items && invResult.items.length > 0) setInventoryItems(invResult.items);
        setInventoryError(null);
        setLastInventorySync(new Date().toISOString());

        if (prodResult.products && prodResult.products.length > 0) setProducts(prodResult.products);
        if (prodResult.bomLines && prodResult.bomLines.length > 0) setProductBomLines(prodResult.bomLines);
        if (jobsResult && jobsResult.length > 0) setProductionJobs(jobsResult);
        if (txnsResult && txnsResult.length > 0) setStockTransactions(txnsResult);
        if (logsResult && logsResult.length > 0) setActivityLogs(logsResult);
      } catch (error) {
`;

content = content.replace(hydrateOld, hydrateNew);

// 3. Instead of rewriting all mutations in app-context, I will write a simple wrapper function
// that syncs an individual entity to Supabase transparently.
const syncUtils = `
  const syncProductToSupabase = (product: Product, bomLines?: ProductBomLine[]) => {
    if (inventorySource !== "supabase" || !isSupabaseConfigured()) return;
    saveProductToSupabase(product).catch(console.error);
    if (bomLines) saveProductBomLinesToSupabase(product.id, bomLines).catch(console.error);
  };
  const syncProductionJobToSupabase = (job: ProductionJob) => {
    if (inventorySource !== "supabase" || !isSupabaseConfigured()) return;
    saveProductionJobToSupabase(job).catch(console.error);
  };
  const syncStockTransactionToSupabase = (txn: StockTransaction) => {
    if (inventorySource !== "supabase" || !isSupabaseConfigured()) return;
    saveStockTransactionToSupabase(txn).catch(console.error);
  };
  const syncActivityLogToSupabase = (log: ActivityLog) => {
    if (inventorySource !== "supabase" || !isSupabaseConfigured()) return;
    saveActivityLogToSupabase(log).catch(console.error);
  };
`;

if (!content.includes('syncProductToSupabase')) {
  content = content.replace('const helperCalculateStatus = (quantity: number, reorderPoint: number)', syncUtils + '\n  const helperCalculateStatus = (quantity: number, reorderPoint: number)');
}

// 4. Inject sync into addActivityLog
content = content.replace(
  'setActivityLogs(prev => [newLog, ...prev]);',
  'setActivityLogs(prev => [newLog, ...prev]);\n    syncActivityLogToSupabase(newLog);'
);

// Inject into addStockTransaction
content = content.replace(
  'setStockTransactions(prev => [newTxn, ...prev]);',
  'setStockTransactions(prev => [newTxn, ...prev]);\n    syncStockTransactionToSupabase(newTxn);'
);

// Inject into updateProduct
content = content.replace(
  'setProducts(prev => prev.map(p => {',
  `const updatedProduct = { ...products.find(p => p.id === id)!, ...updates };
    syncProductToSupabase(updatedProduct);
    setProducts(prev => prev.map(p => {`
);

// Inject into updateProductionJob
content = content.replace(
  'setProductionJobs(prev => prev.map(job => {',
  `const updatedJob = { ...productionJobs.find(job => job.id === id)!, ...updates };
    syncProductionJobToSupabase(updatedJob);
    setProductionJobs(prev => prev.map(job => {`
);

// Inject into addProductionJob
content = content.replace(
  'setProductionJobs(prev => [newJob, ...prev]);',
  'setProductionJobs(prev => [newJob, ...prev]);\n    syncProductionJobToSupabase(newJob);'
);

// Inject into addProduct
content = content.replace(
  'setProductBomLines(prev => [...prev, ...linesToInsert]);',
  'setProductBomLines(prev => [...prev, ...linesToInsert]);\n    syncProductToSupabase(newProduct, linesToInsert);'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Refactoring complete");
