import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

/**
 * Returns a ref that flips to `true` once `load()` has resolved on the
 * client. `load` only runs inside `onMounted`, which Vue never executes
 * during server-side rendering (Nuxt 2 universal mode), so importing this
 * package never evaluates `@chativa/ui` / `@chativa/genui` — both of which
 * touch `customElements` / `document` at module level — on the server.
 */
export function useLoaded(load: () => Promise<unknown>): Ref<boolean> {
  const ready = ref(false);
  let alive = true;
  onMounted(() => {
    void load().then(() => {
      if (alive) ready.value = true;
    });
  });
  onBeforeUnmount(() => {
    alive = false;
  });
  return ready;
}
