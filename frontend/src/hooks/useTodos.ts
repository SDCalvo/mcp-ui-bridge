import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllTodos,
  createTodo as apiCreateTodo,
  updateTodo as apiUpdateTodo,
  deleteTodo as apiDeleteTodo,
} from "../api/todoApi";
import type {
  Todo,
  TodoCreatePayload,
  TodoUpdatePayload,
} from "../api/todoApi";

// Define a common query key for todos
export const todoQueryKeys = {
  all: ["todos"] as const,
  lists: () => [...todoQueryKeys.all, "list"] as const,
  list: (filters: string) => [...todoQueryKeys.lists(), { filters }] as const,
  details: () => [...todoQueryKeys.all, "detail"] as const,
  detail: (id: number) => [...todoQueryKeys.details(), id] as const,
};

export const useGetTodos = (skip: number = 0, limit: number = 100) => {
  return useQuery<Todo[], Error>({
    queryKey: todoQueryKeys.list(`skip=${skip}-limit=${limit}`),
    queryFn: () => getAllTodos(skip, limit),
  });
};

export const useCreateTodo = () => {
  const queryClient = useQueryClient();
  return useMutation<Todo, Error, TodoCreatePayload>({
    mutationFn: apiCreateTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: todoQueryKeys.lists() });
    },
  });
};

export const useUpdateTodo = () => {
  const queryClient = useQueryClient();
  return useMutation<Todo, Error, { id: number; data: TodoUpdatePayload }>({
    mutationFn: ({ id, data }) => apiUpdateTodo(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: todoQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: todoQueryKeys.detail(variables.id),
      });
    },
  });
};

export const useDeleteTodo = () => {
  const queryClient = useQueryClient();
  return useMutation<Todo, Error, number>({
    mutationFn: apiDeleteTodo,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: todoQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: todoQueryKeys.detail(id) });
    },
  });
};
