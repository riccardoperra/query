/* istanbul ignore file */

import {
  type DefaultError,
  type DefinedInfiniteQueryObserverResult,
  type DefinedQueryObserverResult,
  type InfiniteQueryObserverOptions,
  type MutateFunction,
  type MutationObserverOptions,
  type MutationObserverResult,
  type QueryKey,
  type QueryObserverOptions,
  type QueryObserverResult,
} from '@tanstack/query-core'
import type { InfiniteQueryObserverResult } from '@tanstack/query-core'
import type { MapToSignals } from './signal-proxy'

export interface CreateBaseQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends QueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  > {}

export interface CreateQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends Omit<
    CreateBaseQueryOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryFnData,
      TQueryKey
    >,
    'suspense'
  > {}

export interface CreateInfiniteQueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
> extends Omit<
    InfiniteQueryObserverOptions<
      TQueryFnData,
      TError,
      TData,
      TQueryData,
      TQueryKey,
      TPageParam
    >,
    'suspense'
  > {}

export type CreateBaseQueryResult<
  TData = unknown,
  TError = DefaultError,
> = QueryObserverResult<TData, TError>

export type CreateQueryResult<
  TData = unknown,
  TError = DefaultError,
> = QueryObserverResult<TData, TError>

export type DefinedCreateQueryResult<
  TData = unknown,
  TError = DefaultError,
> = DefinedQueryObserverResult<TData, TError>

export type CreateInfiniteQueryResult<
  TData = unknown,
  TError = DefaultError,
> = InfiniteQueryObserverResult<TData, TError>

export type DefinedCreateInfiniteQueryResult<
  TData = unknown,
  TError = DefaultError,
> = DefinedInfiniteQueryObserverResult<TData, TError>

export interface CreateMutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
> extends Omit<
    MutationObserverOptions<TData, TError, TVariables, TContext>,
    '_defaulted'
  > {}

export type CreateMutateFunction<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
> = (
  ...args: Parameters<MutateFunction<TData, TError, TVariables, TContext>>
) => void

export type CreateMutateAsyncFunction<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
> = MutateFunction<TData, TError, TVariables, TContext>

export type CreateBaseMutationResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TContext = unknown,
> = Override<
  MutationObserverResult<TData, TError, TVariables, TContext>,
  { mutate: CreateMutateFunction<TData, TError, TVariables, TContext> }
> & {
  mutateAsync: CreateMutateAsyncFunction<TData, TError, TVariables, TContext>
}

type CreateStatusBasedMutationResult<
  TStatus extends CreateBaseMutationResult['status'],
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TContext = unknown,
> = Extract<
  CreateBaseMutationResult<TData, TError, TVariables, TContext>,
  { status: TStatus }
>

export interface BaseMutationNarrowing<
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TContext = unknown,
> {
  isSuccess: (
    this: CreateMutationResult<TData, TError, TVariables, TContext>,
  ) => this is CreateMutationResult<
    TData,
    TError,
    TVariables,
    TContext,
    CreateStatusBasedMutationResult<
      'success',
      TData,
      TError,
      TVariables,
      TContext
    >
  >
  isError: (
    this: CreateMutationResult<TData, TError, TVariables, TContext>,
  ) => this is CreateMutationResult<
    TData,
    TError,
    TVariables,
    TContext,
    CreateStatusBasedMutationResult<
      'error',
      TData,
      TError,
      TVariables,
      TContext
    >
  >
  isPending: (
    this: CreateMutationResult<TData, TError, TVariables, TContext>,
  ) => this is CreateMutationResult<
    TData,
    TError,
    TVariables,
    TContext,
    CreateStatusBasedMutationResult<
      'pending',
      TData,
      TError,
      TVariables,
      TContext
    >
  >
  isIdle: (
    this: CreateMutationResult<TData, TError, TVariables, TContext>,
  ) => this is CreateMutationResult<
    TData,
    TError,
    TVariables,
    TContext,
    CreateStatusBasedMutationResult<'idle', TData, TError, TVariables, TContext>
  >
}

export type CreateMutationResult<
  TData = unknown,
  TError = DefaultError,
  TVariables = unknown,
  TContext = unknown,
  TState = CreateStatusBasedMutationResult<
    CreateBaseMutationResult['status'],
    TData,
    TError,
    TVariables,
    TContext
  >,
> = BaseMutationNarrowing<TData, TError, TVariables, TContext> &
  MapToSignals<Omit<TState, keyof BaseMutationNarrowing>>

type Override<TTargetA, TTargetB> = {
  [AKey in keyof TTargetA]: AKey extends keyof TTargetB
    ? TTargetB[AKey]
    : TTargetA[AKey]
}
