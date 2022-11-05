<script lang="ts">
  import {page} from '$app/stores';

  $: user = $page.data.user;
</script>

<svelte:head>
  <title>My Profile</title>
</svelte:head>

<section class="container flex-grow">
  <h1>Profile</h1>

  {#if user}
    <p>Welcome, {user?.email}!</p>
  {:else}
    <p>Not logged in.</p>
  {/if}
</section>
