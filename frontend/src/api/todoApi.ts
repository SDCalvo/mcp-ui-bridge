import axios from "axios";

// The base URL for the API, including the /api/v1 prefix
// Ensure VITE_API_URL is set in your .env file (e.g., http://localhost:8000)
const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/v1`;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// TypeScript interfaces matching backend Pydantic schemas
export interface Todo {
  id: number;
  content: string;
  is_completed: boolean;
}

export interface TodoCreatePayload {
  content: string;
  is_completed?: boolean;
}

export interface TodoUpdatePayload {
  content?: string;
  is_completed?: boolean;
}

// API functions
export const getAllTodos = async (
  skip: number = 0,
  limit: number = 100
): Promise<Todo[]> => {
  const response = await apiClient.get<Todo[]>("/todos/", {
    params: { skip, limit },
  });
  return response.data;
};

export const createTodo = async (
  todoData: TodoCreatePayload
): Promise<Todo> => {
  const response = await apiClient.post<Todo>("/todos/", todoData);
  return response.data;
};

export const getTodoById = async (id: number): Promise<Todo> => {
  const response = await apiClient.get<Todo>(`/todos/${id}`);
  return response.data;
};

export const updateTodo = async (
  id: number,
  todoData: TodoUpdatePayload
): Promise<Todo> => {
  const response = await apiClient.put<Todo>(`/todos/${id}`, todoData);
  return response.data;
};

export const deleteTodo = async (id: number): Promise<Todo> => {
  // Backend returns the deleted todo item as per current router setup
  const response = await apiClient.delete<Todo>(`/todos/${id}`);
  return response.data;
};
