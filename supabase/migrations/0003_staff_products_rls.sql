create policy "staff write products" on public.products for insert with check (auth.role() = 'authenticated');
create policy "staff update products" on public.products for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "staff write bom" on public.product_bom_lines for insert with check (auth.role() = 'authenticated');
create policy "staff update bom" on public.product_bom_lines for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
