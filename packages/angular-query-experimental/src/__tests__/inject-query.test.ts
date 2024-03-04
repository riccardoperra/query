import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core'
import { fakeAsync, flush, TestBed, tick } from '@angular/core/testing'
import { QueryClient } from '@tanstack/query-core'
import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/angular'
import { injectQuery } from '../inject-query'
import { provideAngularQuery } from '../providers'
import {
  delayedFetcher,
  getSimpleFetcherWithReturnData,
  rejectFetcher,
  simpleFetcher,
  unwrapProxy,
} from './test-utils'
import type { CreateQueryResult } from '../types'

describe('injectQuery', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAngularQuery(new QueryClient())],
    })
  })

  test('should return pending status initially', fakeAsync(() => {
    const query = TestBed.runInInjectionContext(() => {
      return injectQuery(() => ({
        queryKey: ['key1'],
        queryFn: simpleFetcher,
      }))
    })

    expect(query.status()).toBe('pending')
    expect(query.isPending()).toBe(true)
    expect(query.isFetching()).toBe(true)
    expect(query.isStale()).toBe(true)
    expect(query.isFetched()).toBe(false)

    flush()
  }))

  test('should resolve to success and update signal: injectQuery()', fakeAsync(() => {
    const query = TestBed.runInInjectionContext(() => {
      return injectQuery(() => ({
        queryKey: ['key2'],
        queryFn: getSimpleFetcherWithReturnData('result2'),
      }))
    })

    flush()

    expect(query.status()).toBe('success')
    expect(query.data()).toBe('result2')
    expect(query.isPending()).toBe(false)
    expect(query.isFetching()).toBe(false)
    expect(query.isFetched()).toBe(true)
    expect(query.isSuccess()).toBe(true)
  }))

  test('should reject and update signal', fakeAsync(() => {
    const query = TestBed.runInInjectionContext(() => {
      return injectQuery(() => ({
        retry: false,
        queryKey: ['key3'],
        queryFn: rejectFetcher,
      }))
    })

    flush()

    expect(query.status()).toBe('error')
    expect(query.data()).toBe(undefined)
    expect(query.error()).toMatchObject({ message: 'Some error' })
    expect(query.isPending()).toBe(false)
    expect(query.isFetching()).toBe(false)
    expect(query.isError()).toBe(true)
    expect(query.failureCount()).toBe(1)
    expect(query.failureReason()).toMatchObject({ message: 'Some error' })
  }))

  test('should update query on options contained signal change', fakeAsync(() => {
    const key = signal(['key6', 'key7'])
    const spy = vi.fn(simpleFetcher)

    const query = TestBed.runInInjectionContext(() => {
      return injectQuery(() => ({
        queryKey: key(),
        queryFn: spy,
      }))
    })
    flush()
    expect(spy).toHaveBeenCalledTimes(1)

    expect(query.status()).toBe('success')

    key.set(['key8'])
    TestBed.flushEffects()

    expect(spy).toHaveBeenCalledTimes(2)

    flush()
  }))

  test('should only run query once enabled signal is set to true', fakeAsync(() => {
    const spy = vi.fn(simpleFetcher)
    const enabled = signal(false)

    const query = TestBed.runInInjectionContext(() => {
      return injectQuery(() => ({
        queryKey: ['key9'],
        queryFn: spy,
        enabled: enabled(),
      }))
    })

    expect(spy).not.toHaveBeenCalled()
    expect(query.status()).toBe('pending')

    enabled.set(true)
    TestBed.flushEffects()
    flush()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(query.status()).toBe('success')
  }))

  test('should properly execute dependant queries', fakeAsync(() => {
    const query1 = TestBed.runInInjectionContext(() => {
      return injectQuery(() => ({
        queryKey: ['dependant1'],
        queryFn: simpleFetcher,
      }))
    })

    const dependentQueryFn = vi.fn().mockImplementation(delayedFetcher(1000))

    const query2 = TestBed.runInInjectionContext(() => {
      return injectQuery(
        computed(() => ({
          queryKey: ['dependant2'],
          queryFn: dependentQueryFn,
          enabled: !!query1.data(),
        })),
      )
    })

    expect(query1.data()).toStrictEqual(undefined)
    expect(query2.fetchStatus()).toStrictEqual('idle')
    expect(dependentQueryFn).not.toHaveBeenCalled()

    tick()
    TestBed.flushEffects()

    expect(query1.data()).toStrictEqual('Some data')
    expect(query2.fetchStatus()).toStrictEqual('fetching')

    flush()

    expect(query2.fetchStatus()).toStrictEqual('idle')
    expect(query2.status()).toStrictEqual('success')
    expect(dependentQueryFn).toHaveBeenCalledTimes(1)
    expect(dependentQueryFn).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['dependant2'] }),
    )
  }))

  test('should use the current value for the queryKey when refetch is called', fakeAsync(() => {
    const fetchFn = vi.fn(simpleFetcher)
    const keySignal = signal('key11')

    const query = TestBed.runInInjectionContext(() => {
      return injectQuery(() => ({
        queryKey: ['key10', keySignal()],
        queryFn: fetchFn,
        enabled: false,
      }))
    })

    expect(fetchFn).not.toHaveBeenCalled()

    query.refetch().then(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1)
      expect(fetchFn).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['key10', 'key11'],
        }),
      )
    })

    flush()

    keySignal.set('key12')

    TestBed.flushEffects()

    query.refetch().then(() => {
      expect(fetchFn).toHaveBeenCalledTimes(2)
      expect(fetchFn).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['key10', 'key12'],
        }),
      )
    })

    flush()
  }))

  test('should set state to error when queryFn returns reject promise', fakeAsync(() => {
    const query = TestBed.runInInjectionContext(() => {
      return injectQuery(() => ({
        retry: false,
        queryKey: ['key13'],
        queryFn: rejectFetcher,
      }))
    })

    expect(query.status()).toBe('pending')

    flush()

    expect(query.status()).toBe('error')
  }))
})

let queryKeyCount = 0

export function queryKey(): Array<string> {
  queryKeyCount++
  return [`query_${queryKeyCount}`]
}

export function sleep(timeout: number): Promise<void> {
  return new Promise((resolve, _reject) => {
    setTimeout(resolve, timeout)
  })
}

describe('test porting', () => {
  const queryClient = new QueryClient()
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAngularQuery(queryClient)],
    })
  })

  it('should allow to set default data value', async () => {
    const key = queryKey()

    @Component({
      selector: 'app-page',
      template: `
        <div>
          <h1>{{ query.data() || 'default' }}</h1>
        </div>
      `,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class PageComponent {
      readonly query = injectQuery(() => ({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 'test'
        },
      }))
    }

    const rendered = await render(PageComponent, {
      providers: [provideAngularQuery(new QueryClient())],
    })

    rendered.getByText('default')

    await waitFor(() => rendered.getByText('test'))
  })

  it('should return the correct states for a successful query', async () => {
    const key = queryKey()
    const states: Array<CreateQueryResult<string>> = []

    @Component({
      selector: 'app-page',
      template: `
        {{ render() }}

        @if (state.isPending()) {
          <span>pending</span>
        }
        @if (state.isLoadingError()) {
          <span>{{ state.error().message }}</span>
        }
        <span>{{ state.data() }}</span>
      `,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class PageComponent {
      readonly state = injectQuery(() => ({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 'test'
        },
      }))

      render(): void {
        states.push(unwrapProxy(this.state))
      }
    }

    const rendered = await render(PageComponent, {
      providers: [provideAngularQuery(new QueryClient())],
    })

    await waitFor(() => rendered.getByText('test'))

    expect(states.length).toEqual(2)

    expect(states[0]).toEqual({
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isError: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: true,
      isPaused: false,
      isPending: true,
      isInitialLoading: true,
      isLoading: true,
      isLoadingError: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: false,
      refetch: expect.any(Function),
      status: 'pending',
      fetchStatus: 'fetching',
    })

    expect(states[1]).toEqual({
      data: 'test',
      dataUpdatedAt: expect.any(Number),
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isPaused: false,
      isPending: false,
      isInitialLoading: false,
      isLoading: false,
      isLoadingError: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: true,
      refetch: expect.any(Function),
      status: 'success',
      fetchStatus: 'idle',
    })
  })

  it('should return the correct states for a unsuccessful query', async () => {
    const key = queryKey()
    const states: Array<CreateQueryResult<never>> = []

    @Component({
      selector: 'app-page',
      template: `
        {{ render() }}

        <div>
          <h1>Status: {{ state.status() }}</h1>
          <div>Failure Count: {{ state.failureCount() }}</div>
          <div>Failure Reason: {{ state.failureReason()?.message }}</div>
        </div>
      `,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class PageComponent {
      readonly state = injectQuery(() => ({
        queryKey: key,
        queryFn: () => Promise.reject(new Error('rejected')),
        retry: 1,
        retryDelay: 1,
      }))

      render(): void {
        states.push(unwrapProxy(this.state))
      }
    }

    const rendered = await render(PageComponent, {
      providers: [provideAngularQuery(new QueryClient())],
    })

    await waitFor(() => rendered.getByText('Status: error'))

    expect(states[0]).toEqual({
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isError: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: true,
      isPaused: false,
      isPending: true,
      isInitialLoading: true,
      isLoading: true,
      isLoadingError: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: false,
      refetch: expect.any(Function),
      status: 'pending',
      fetchStatus: 'fetching',
    })

    expect(states[1]).toEqual({
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 1,
      failureReason: new Error('rejected'),
      errorUpdateCount: 0,
      isError: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: true,
      isPaused: false,
      isPending: true,
      isInitialLoading: true,
      isLoading: true,
      isLoadingError: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: false,
      refetch: expect.any(Function),
      status: 'pending',
      fetchStatus: 'fetching',
    })

    expect(states[2]).toEqual({
      data: undefined,
      dataUpdatedAt: 0,
      error: new Error('rejected'),
      errorUpdatedAt: expect.any(Number),
      failureCount: 2,
      failureReason: new Error('rejected'),
      errorUpdateCount: 1,
      isError: true,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isPaused: false,
      isPending: false,
      isInitialLoading: false,
      isLoading: false,
      isLoadingError: true,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: false,
      refetch: expect.any(Function),
      status: 'error',
      fetchStatus: 'idle',
    })
  })

  it('should set isFetchedAfterMount to true after a query has been fetched', async () => {
    const key = queryKey()

    await queryClient.prefetchQuery({
      queryKey: key,
      queryFn: () => 'prefetched',
    })

    @Component({
      selector: 'app-page',
      template: `
        <div>data: {{ result.data() }}</div>
        <div>isFetched: {{ result.isFetched() ? 'true' : 'false' }}</div>
        <div>
          isFetchedAfterMount:
          {{ result.isFetchedAfterMount() ? 'true' : 'false' }}
        </div>
      `,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class PageComponent {
      readonly result = injectQuery(() => ({
        queryKey: key,
        queryFn: () => 'new data',
      }))
    }

    const rendered = await render(PageComponent, {
      providers: [provideAngularQuery(queryClient)],
    })
    rendered.getByText('data: prefetched')
    rendered.getByText('isFetched: true')
    rendered.getByText('isFetchedAfterMount: false')

    await waitFor(() => {
      rendered.getByText('data: new data')
      rendered.getByText('isFetched: true')
      rendered.getByText('isFetchedAfterMount: true')
    })
  })

  it('should be able to watch a query without providing a query function', () => {})
})
