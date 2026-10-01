import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { usePagination } from './usePagination';

const ITEMS = Array.from({ length: 25 }, (_, i) => `item-${i}`);

describe('usePagination', () => {
  test('slices the first page by default', () => {
    const { result } = renderHook(() => usePagination(ITEMS, 10));
    expect(result.current.pageItems).toEqual(ITEMS.slice(0, 10));
    expect(result.current.page).toBe(1);
    expect(result.current.pageCount).toBe(3);
    expect(result.current.total).toBe(25);
    expect(result.current.start).toBe(0);
  });

  test('setPage moves to the requested page', () => {
    const { result } = renderHook(() => usePagination(ITEMS, 10));
    act(() => result.current.setPage(2));
    expect(result.current.pageItems).toEqual(ITEMS.slice(10, 20));
    expect(result.current.start).toBe(10);
  });

  test('a page number past the end clamps back to the last real page', () => {
    const { result } = renderHook(() => usePagination(ITEMS, 10));
    act(() => result.current.setPage(99));
    expect(result.current.page).toBe(3); // 25 items / 10 per page = 3 pages
    expect(result.current.pageItems).toEqual(ITEMS.slice(20, 25));
  });

  test('changePageSize resets back to page 1', () => {
    const { result } = renderHook(() => usePagination(ITEMS, 10));
    act(() => result.current.setPage(2));
    act(() => result.current.changePageSize(25));
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(25);
    expect(result.current.pageItems).toEqual(ITEMS);
  });

  test('an empty list is still one (empty) page, not zero', () => {
    const { result } = renderHook(() => usePagination([], 10));
    expect(result.current.pageCount).toBe(1);
    expect(result.current.pageItems).toEqual([]);
  });
});
